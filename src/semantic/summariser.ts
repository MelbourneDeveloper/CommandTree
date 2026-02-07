import * as vscode from 'vscode';
import type { Result } from '../models/TaskItem';
import { ok, err } from '../models/TaskItem';
import { logger } from '../utils/logger';

const MAX_CONTENT_LENGTH = 4000;

/**
 * Selects a Copilot chat model for summarisation.
 */
export async function selectCopilotModel(): Promise<Result<vscode.LanguageModelChat, string>> {
    try {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        const model = models[0];
        if (model === undefined) {
            return err('No Copilot model available. Is GitHub Copilot installed?');
        }
        logger.info('Selected Copilot model', { id: model.id, name: model.name });
        return ok(model);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to select Copilot model';
        return err(message);
    }
}

/**
 * Generates a plain-language summary for a script.
 */
export async function summariseScript(params: {
    readonly model: vscode.LanguageModelChat;
    readonly label: string;
    readonly type: string;
    readonly command: string;
    readonly content: string;
}): Promise<Result<string, string>> {
    const truncated = params.content.length > MAX_CONTENT_LENGTH
        ? params.content.substring(0, MAX_CONTENT_LENGTH)
        : params.content;

    const prompt = [
        `Summarise this ${params.type} command in 1-2 sentences.`,
        `Name: ${params.label}`,
        `Command: ${params.command}`,
        '',
        'Script content:',
        truncated
    ].join('\n');

    const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
    ];

    try {
        const response = await params.model.sendRequest(
            messages,
            {},
            new vscode.CancellationTokenSource().token
        );

        const chunks: string[] = [];
        for await (const chunk of response.text) {
            chunks.push(chunk);
        }
        const summary = chunks.join('').trim();

        if (summary === '') {
            return err('Empty summary returned');
        }

        logger.info('Generated summary', { label: params.label, summary });
        return ok(summary);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to generate summary';
        logger.error('Summarisation failed', { label: params.label, error: message });
        return err(message);
    }
}

/**
 * Uses the LLM to rank commands by relevance to a natural language query.
 * Returns command IDs sorted by relevance (most relevant first).
 */
export async function rankByRelevance(params: {
    readonly model: vscode.LanguageModelChat;
    readonly query: string;
    readonly candidates: ReadonlyArray<{ readonly id: string; readonly summary: string }>;
}): Promise<Result<string[], string>> {
    if (params.candidates.length === 0) {
        return ok([]);
    }

    const candidateList = params.candidates
        .map((c, i) => `[${i}] ${c.summary}`)
        .join('\n');

    const prompt = [
        'Given this search query and list of command summaries,',
        'return ONLY the indices of relevant matches, most relevant first.',
        'Return just comma-separated numbers, nothing else.',
        'If nothing matches, return "none".',
        '',
        `Query: "${params.query}"`,
        '',
        'Commands:',
        candidateList
    ].join('\n');

    const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
    ];

    try {
        const response = await params.model.sendRequest(
            messages,
            {},
            new vscode.CancellationTokenSource().token
        );

        const chunks: string[] = [];
        for await (const chunk of response.text) {
            chunks.push(chunk);
        }
        const result = chunks.join('').trim();

        if (result === 'none' || result === '') {
            return ok([]);
        }

        const ids = parseRankedIndices(result, params.candidates);
        return ok(ids);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to rank results';
        logger.error('Ranking failed', { query: params.query, error: message });
        return err(message);
    }
}

/**
 * Parses comma-separated indices from the LLM response into command IDs.
 */
function parseRankedIndices(
    response: string,
    candidates: ReadonlyArray<{ readonly id: string; readonly summary: string }>
): string[] {
    const ids: string[] = [];
    const parts = response.split(',');

    for (const part of parts) {
        const trimmed = part.trim();
        const index = parseInt(trimmed, 10);
        if (!isNaN(index) && index >= 0 && index < candidates.length) {
            const candidate = candidates[index];
            if (candidate !== undefined) {
                ids.push(candidate.id);
            }
        }
    }

    return ids;
}
