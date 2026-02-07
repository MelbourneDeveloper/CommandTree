import type { TaskItem, Result } from '../models/TaskItem';
import { ok } from '../models/TaskItem';
import { logger } from '../utils/logger';
import { getDb } from '../semantic/lifecycle';
import {
    getAllTagRows,
    getTagPatterns as dbGetTagPatterns,
    getTagNames as dbGetTagNames,
    addPatternToTag,
    removePatternFromTag,
    replaceTagPatterns,
} from '../semantic/db';

/**
 * Structured tag pattern for matching commands.
 */
interface TagPattern {
    id?: string;
    type?: string;
    label?: string;
}

type TagDefinition = Record<string, Array<string | TagPattern>>;

/**
 * Manages command tags stored in the SQLite database.
 */
export class TagConfig {
    private tags: TagDefinition = {};

    /**
     * Loads tag configuration from SQLite.
     */
    async load(): Promise<void> {
        const dbResult = getDb();
        if (!dbResult.ok) {
            logger.config('Database not available for tag loading', { error: dbResult.error });
            this.tags = {};
            return;
        }
        const rowsResult = getAllTagRows(dbResult.value);
        if (!rowsResult.ok) {
            logger.config('Failed to load tags from SQLite', { error: rowsResult.error });
            this.tags = {};
            return;
        }
        this.tags = this.rowsToDefinition(rowsResult.value);
        logger.config('Loaded tags from SQLite', { tags: this.tags as Record<string, unknown> });
    }

    /**
     * Converts flat tag rows into a grouped TagDefinition.
     */
    private rowsToDefinition(rows: ReadonlyArray<{ tagName: string; pattern: string }>): TagDefinition {
        const result: TagDefinition = {};
        for (const row of rows) {
            const parsed = this.parsePattern(row.pattern);
            const existing = result[row.tagName] ?? [];
            result[row.tagName] = [...existing, parsed];
        }
        return result;
    }

    /**
     * Parses a stored pattern string into either a string ID or a TagPattern object.
     */
    private parsePattern(raw: string): string | TagPattern {
        if (raw.startsWith('{')) {
            try {
                return JSON.parse(raw) as TagPattern;
            } catch {
                return raw;
            }
        }
        return raw;
    }

    /**
     * Applies tags to a list of commands based on patterns.
     */
    applyTags(tasks: TaskItem[]): TaskItem[] {
        logger.tag('applyTags called', { taskCount: tasks.length });
        if (Object.keys(this.tags).length === 0) {
            logger.tag('No tags configured', {});
            return tasks;
        }
        const result = tasks.map(task => this.tagOneTask(task));
        const taggedCount = result.filter(t => t.tags.length > 0).length;
        logger.tag('applyTags complete', { taskCount: tasks.length, taggedCount });
        return result;
    }

    /**
     * Applies matching tag patterns to a single task.
     */
    private tagOneTask(task: TaskItem): TaskItem {
        if (Object.keys(this.tags).length === 0) { return task; }
        const matchedTags: string[] = [];
        for (const [tagName, patterns] of Object.entries(this.tags)) {
            for (const pattern of patterns) {
                const matches = typeof pattern === 'string'
                    ? this.matchesStringPattern(task, pattern)
                    : this.matchesPattern(task, pattern);
                if (matches) {
                    matchedTags.push(tagName);
                    break;
                }
            }
        }
        return matchedTags.length > 0 ? { ...task, tags: matchedTags } : task;
    }

    /**
     * Gets all defined tag names.
     */
    getTagNames(): string[] {
        const dbResult = getDb();
        if (!dbResult.ok) { return Object.keys(this.tags); }
        const namesResult = dbGetTagNames(dbResult.value);
        return namesResult.ok ? namesResult.value : Object.keys(this.tags);
    }

    /**
     * Adds a command to a specific tag by adding its full ID.
     */
    async addTaskToTag(task: TaskItem, tagName: string): Promise<Result<void, string>> {
        const dbResult = getDb();
        if (!dbResult.ok) { return dbResult; }
        const result = addPatternToTag({
            handle: dbResult.value,
            tagName,
            pattern: task.id,
        });
        if (result.ok) { await this.load(); }
        return result;
    }

    /**
     * Removes a command from a specific tag.
     */
    async removeTaskFromTag(task: TaskItem, tagName: string): Promise<Result<void, string>> {
        const dbResult = getDb();
        if (!dbResult.ok) { return dbResult; }
        const result = removePatternFromTag({
            handle: dbResult.value,
            tagName,
            pattern: task.id,
        });
        if (result.ok) { await this.load(); }
        return result;
    }

    /**
     * Gets the patterns for a specific tag in order.
     */
    getTagPatterns(tagName: string): string[] {
        const dbResult = getDb();
        if (!dbResult.ok) {
            const patterns = this.tags[tagName] ?? [];
            return patterns.filter((p): p is string => typeof p === 'string');
        }
        const result = dbGetTagPatterns({ handle: dbResult.value, tagName });
        if (!result.ok) {
            const patterns = this.tags[tagName] ?? [];
            return patterns.filter((p): p is string => typeof p === 'string');
        }
        return result.value;
    }

    /**
     * Moves a command to a new position within a tag's pattern list.
     */
    async moveTaskInTag(task: TaskItem, tagName: string, newIndex: number): Promise<Result<void, string>> {
        const dbResult = getDb();
        if (!dbResult.ok) { return dbResult; }

        const patternsResult = dbGetTagPatterns({ handle: dbResult.value, tagName });
        if (!patternsResult.ok) { return patternsResult; }

        const patterns = [...patternsResult.value];
        const currentIndex = patterns.indexOf(task.id);
        if (currentIndex === -1) { return ok(undefined); }

        patterns.splice(currentIndex, 1);
        const insertAt = newIndex > currentIndex ? newIndex - 1 : newIndex;
        patterns.splice(Math.max(0, Math.min(insertAt, patterns.length)), 0, task.id);

        const result = replaceTagPatterns({
            handle: dbResult.value,
            tagName,
            patterns,
        });
        if (result.ok) { await this.load(); }
        return result;
    }

    /**
     * Checks if a command matches a string pattern.
     * Supports exact ID match or type:label format.
     */
    private matchesStringPattern(task: TaskItem, pattern: string): boolean {
        if (task.id === pattern) { return true; }
        const colonIndex = pattern.indexOf(':');
        if (colonIndex > 0) {
            const patternType = pattern.substring(0, colonIndex);
            const patternLabel = pattern.substring(colonIndex + 1);
            return task.type === patternType && task.label === patternLabel;
        }
        return false;
    }

    /**
     * Checks if a command matches a structured pattern object.
     */
    private matchesPattern(task: TaskItem, pattern: TagPattern): boolean {
        if (pattern.id !== undefined) { return task.id === pattern.id; }
        const typeMatches = pattern.type === undefined || task.type === pattern.type;
        const labelMatches = pattern.label === undefined || task.label === pattern.label;
        return typeMatches && labelMatches;
    }
}
