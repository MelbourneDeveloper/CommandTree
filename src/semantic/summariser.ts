/**
 * SPEC: ai-summary-generation
 *
 * GitHub Copilot integration for generating command summaries.
 * Uses VS Code Language Model Tool API for structured output (summary + security warning).
 */
import * as vscode from 'vscode';
import type { Result } from '../models/TaskItem';
import { ok, err } from '../models/TaskItem';
import { logger } from '../utils/logger';

const MAX_CONTENT_LENGTH = 4000;
const MODEL_RETRY_COUNT = 10;
const MODEL_RETRY_DELAY_MS = 2000;

const TOOL_NAME = 'report_command_analysis';

export interface SummaryResult {
    readonly summary: string;
    readonly securityWarning: string;
}

const ANALYSIS_TOOL: vscode.LanguageModelChatTool = {
    name: TOOL_NAME,
    description: 'Report the analysis of a command including summary and any security warnings',
    inputSchema: {
        type: 'object',
        properties: {
            summary: {
                type: 'string',
                description: 'Plain-language summary of the command in 1-2 sentences'
            },
            securityWarning: {
                type: 'string',
                description: 'Security warning if the command has risks (deletes files, writes credentials, modifies system config, runs untrusted code). Empty string if no risks.'
            }
        },
        required: ['summary', 'securityWarning']
    }
};

/**
 * Waits for a delay (used for retry backoff).
 */
async function delay(ms: number): Promise<void> {
    await new Promise<void>(resolve => { setTimeout(resolve, ms); });
}

/**
 * Attempts to select a Copilot model once.
 */
async function trySelectModel(): Promise<vscode.LanguageModelChat | null> {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    return models[0] ?? null;
}

/**
 * Selects a Copilot chat model for summarisation.
 * Retries to allow Copilot time to initialise after VS Code starts.
 */
export async function selectCopilotModel(): Promise<Result<vscode.LanguageModelChat, string>> {
    for (let attempt = 0; attempt < MODEL_RETRY_COUNT; attempt++) {
        try {
            const model = await trySelectModel();
            if (model !== null) {
                logger.info('Selected Copilot model', { id: model.id, name: model.name });
                return ok(model);
            }
            logger.info('Copilot not ready, retrying', { attempt });
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown';
            logger.warn('Model selection error', { attempt, error: msg });
        }
        if (attempt < MODEL_RETRY_COUNT - 1) { await delay(MODEL_RETRY_DELAY_MS); }
    }
    return err('No Copilot model available after retries');
}

/**
 * Extracts the tool call result from the LLM response stream.
 */
async function extractToolCall(
    response: vscode.LanguageModelChatResponse
): Promise<SummaryResult | null> {
    for await (const part of response.stream) {
        if (part instanceof vscode.LanguageModelToolCallPart) {
            const input = part.input as Record<string, unknown>;
            const summary = typeof input['summary'] === 'string' ? input['summary'] : '';
            const warning = typeof input['securityWarning'] === 'string' ? input['securityWarning'] : '';
            return { summary, securityWarning: warning };
        }
    }
    return null;
}

/**
 * Sends a chat request with tool calling to get structured output.
 */
async function sendToolRequest(
    model: vscode.LanguageModelChat,
    prompt: string
): Promise<Result<SummaryResult, string>> {
    try {
        const messages = [vscode.LanguageModelChatMessage.User(prompt)];
        const options: vscode.LanguageModelChatRequestOptions = {
            tools: [ANALYSIS_TOOL],
            toolMode: vscode.LanguageModelChatToolMode.Required
        };
        const response = await model.sendRequest(messages, options, new vscode.CancellationTokenSource().token);
        const result = await extractToolCall(response);
        if (result === null) { return err('No tool call in LLM response'); }
        return ok(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'LLM request failed';
        return err(message);
    }
}

/**
 * Builds the prompt for script summarisation.
 */
function buildSummaryPrompt(params: {
    readonly type: string;
    readonly label: string;
    readonly command: string;
    readonly content: string;
}): string {
    const truncated = params.content.length > MAX_CONTENT_LENGTH
        ? params.content.substring(0, MAX_CONTENT_LENGTH)
        : params.content;

    return [
        `Analyse this ${params.type} command. Provide a plain-language summary (1-2 sentences).`,
        `If the command has security risks (writes credentials, deletes files, modifies system config, runs untrusted code, etc.), describe the risk. Otherwise leave securityWarning empty.`,
        `Name: ${params.label}`,
        `Command: ${params.command}`,
        '',
        'Script content:',
        truncated
    ].join('\n');
}

/**
 * Generates a structured summary for a script via Copilot tool calling.
 */
export async function summariseScript(params: {
    readonly model: vscode.LanguageModelChat;
    readonly label: string;
    readonly type: string;
    readonly command: string;
    readonly content: string;
}): Promise<Result<SummaryResult, string>> {
    const prompt = buildSummaryPrompt(params);
    const result = await sendToolRequest(params.model, prompt);

    if (!result.ok) {
        logger.error('Summarisation failed', { label: params.label, error: result.error });
        return result;
    }
    if (result.value.summary === '') {
        return err('Empty summary returned');
    }

    logger.info('Generated summary', {
        label: params.label,
        summary: result.value.summary,
        hasWarning: result.value.securityWarning !== ''
    });
    return result;
}

/**
 * NO FALLBACK SUMMARIES.
 * Every summary MUST come from a real LLM (Copilot).
 * Fake metadata strings let tests pass without exercising the real pipeline.
 * If Copilot is unavailable, summarisation MUST fail — not silently degrade.
 */
