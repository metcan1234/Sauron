"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactHandoffPrompt = compactHandoffPrompt;
const TRANSCRIPT_HEADER = "Recent conversation:";
function stripTranscriptBlock(prompt) {
    const idx = prompt.indexOf(TRANSCRIPT_HEADER);
    if (idx === -1) {
        return prompt;
    }
    return prompt.slice(0, idx).trimEnd();
}
function truncatePreservingGoalAndSteps(prompt, maxChars) {
    const text = prompt.trim();
    if (text.length <= maxChars) {
        return text;
    }
    const goalBlock = text.match(/Goal:[^\n]*(?:\n(?!Plan steps:|Acceptance:|Touched files:|User intent:|Recent conversation:)[^\n]*)*/)?.[0] ||
        "";
    const stepsBlock = text.match(/Plan steps:[\s\S]*?(?=\n\n(?:Acceptance:|Touched files:|User intent:|Recent conversation:)|$)/)?.[0] ||
        "";
    const preserved = [goalBlock, stepsBlock].filter(Boolean).join("\n\n").trim();
    if (preserved.length >= maxChars) {
        return preserved.slice(0, maxChars);
    }
    const remainder = maxChars - preserved.length - (preserved ? 2 : 0);
    if (remainder <= 0) {
        return preserved;
    }
    const rest = text.replace(goalBlock, "").replace(stepsBlock, "").trim();
    return [preserved, rest.slice(0, remainder)].filter(Boolean).join("\n\n");
}
function compactHandoffPrompt(prompt, optimizer, options) {
    const trimmed = String(prompt || "").trim();
    const tokenUltraEnabled = options?.tokenUltraEnabled === true;
    if (!trimmed || (!optimizer.enabled && !tokenUltraEnabled)) {
        return trimmed;
    }
    let next = trimmed;
    if (!optimizer.routing.includeTranscript) {
        next = stripTranscriptBlock(next);
    }
    const maxChars = optimizer.routing.handoffMaxChars;
    if (next.length <= maxChars) {
        return next;
    }
    const truncated = truncatePreservingGoalAndSteps(next, maxChars);
    if (truncated.length <= maxChars) {
        return truncated;
    }
    return truncated.slice(0, maxChars);
}
//# sourceMappingURL=compact-handoff.js.map