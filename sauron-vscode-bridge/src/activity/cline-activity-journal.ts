import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import type { ActiveTaskMetrics } from "../cline"
import type { SauronHandoff } from "../handoff/types"

export const ACTIVITY_FILENAME = "cline-activity.jsonl"
export const MAX_LINES = 200
const MAX_JOURNAL_LINES = MAX_LINES

export type ActivityKind = "plan" | "activity" | "report" | "question"

export interface ActivityEvent {
	id: string
	kind: ActivityKind
	title: string
	body: string
	at: string
	scopeKey?: string
	handoffId?: string
}

function basenameOnly(filePath: string): string {
	const parts = String(filePath || "").split(/[/\\]/)
	return parts[parts.length - 1] || filePath
}

function makeId(prefix: string, seed: string): string {
	const hash = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12)
	return `${prefix}-${hash}`
}

export function buildPlanFromHandoff(handoff: SauronHandoff): { title: string; body: string } {
	const goal = String(handoff.goal || handoff.taskSummary || "").trim()
	if (!goal) {
		return { title: "Cline görevi", body: "" }
	}

	const steps: string[] = []
	let stepIndex = 1

	if (handoff.relevantFiles?.length) {
		const files = handoff.relevantFiles.slice(0, 4).map(basenameOnly).join(", ")
		steps.push(`${stepIndex}. İlgili dosyaları incele (${files})`)
		stepIndex += 1
	}

	if (handoff.pipelineId && handoff.pipelinePhase) {
		const total = handoff.pipelineTotalPhases ? ` / ${handoff.pipelineTotalPhases}` : ""
		const label = handoff.pipelineLabel || handoff.pipelineId
		steps.push(`${stepIndex}. Üretim hattı faz ${handoff.pipelinePhase}${total} — ${label}`)
		stepIndex += 1
	} else if (handoff.projectType) {
		steps.push(`${stepIndex}. Proje türü: ${handoff.projectType}`)
		stepIndex += 1
	}

	if (handoff.batchScope?.length) {
		const scope = handoff.batchScope.slice(0, 4).join(", ")
		steps.push(`${stepIndex}. Kapsam: ${scope}`)
		stepIndex += 1
	}

	if (handoff.verification?.command) {
		steps.push(`${stepIndex}. Bitince doğrula: ${handoff.verification.command}`)
	} else {
		steps.push(`${stepIndex}. Görevi tamamla ve sonucu raporla`)
	}

	const body = [`Hedef: ${goal}`, "", "Adımlar:", ...steps].join("\n")
	return {
		title: goal.length > 72 ? `${goal.slice(0, 69)}…` : goal,
		body,
	}
}

export async function appendClineActivityEvent(
	workspaceRoot: string,
	event: Omit<ActivityEvent, "id" | "at"> & { id?: string; at?: string },
): Promise<ActivityEvent> {
	const journalPath = path.join(workspaceRoot, ".sauron", ACTIVITY_FILENAME)
	await fs.mkdir(path.dirname(journalPath), { recursive: true })

	const fullEvent: ActivityEvent = {
		id: event.id || makeId(event.kind, `${event.title}:${event.body}:${Date.now()}`),
		kind: event.kind,
		title: event.title,
		body: event.body,
		at: event.at || new Date().toISOString(),
		scopeKey: event.scopeKey,
		handoffId: event.handoffId,
	}

	let existing = ""
	try {
		existing = await fs.readFile(journalPath, "utf8")
	} catch {
		// journal may not exist yet
	}

	const lines = `${existing}${JSON.stringify(fullEvent)}\n`.split(/\r?\n/).filter(Boolean)
	const pruned = lines.length > MAX_JOURNAL_LINES ? lines.slice(lines.length - MAX_JOURNAL_LINES) : lines
	await fs.writeFile(journalPath, `${pruned.join("\n")}\n`, "utf8")
	return fullEvent
}

export async function journalHandoffPlan(workspaceRoot: string, handoff: SauronHandoff): Promise<void> {
	const plan = buildPlanFromHandoff(handoff)
	if (!plan.body) {
		return
	}
	await appendClineActivityEvent(workspaceRoot, {
		kind: "plan",
		title: plan.title,
		body: plan.body,
		scopeKey: handoff.id || "",
		handoffId: handoff.id,
		id: makeId("plan", `${handoff.id || plan.title}`),
	})
}

export async function journalHandoffActivityStart(
	workspaceRoot: string,
	handoff: SauronHandoff,
): Promise<void> {
	await appendClineActivityEvent(workspaceRoot, {
		kind: "activity",
		title: "Cline göreve başladı",
		body: handoff.goal || handoff.taskSummary || "Görev işleniyor",
		scopeKey: handoff.id || "active",
		handoffId: handoff.id,
		id: makeId("activity-start", `${handoff.id || ""}:${Date.now()}`),
	})
}

export async function journalHandoffQuestion(
	workspaceRoot: string,
	handoffId: string,
	body: string,
): Promise<void> {
	await appendClineActivityEvent(workspaceRoot, {
		kind: "question",
		title: "Karar gerekli",
		body,
		scopeKey: handoffId,
		handoffId,
		id: makeId("question", `${handoffId}:${body}`),
	})
}

export async function journalTaskActivity(
	workspaceRoot: string,
	metrics: ActiveTaskMetrics,
	scopeKey: string,
): Promise<void> {
	await appendClineActivityEvent(workspaceRoot, {
		kind: "activity",
		title: "Cline çalışıyor",
		body: `Model: ${metrics.modelId || "bilinmiyor"} · token: ${metrics.tokensIn + metrics.tokensOut}`,
		scopeKey,
		id: makeId("activity", `${scopeKey}:${metrics.tokensIn}:${metrics.tokensOut}`),
	})
}

export async function journalTaskReport(
	workspaceRoot: string,
	summary: string,
	handoffId?: string,
): Promise<void> {
	await appendClineActivityEvent(workspaceRoot, {
		kind: "report",
		title: "Görev tamamlandı",
		body: summary || "Cline görevi bitti.",
		scopeKey: handoffId || "complete",
		handoffId,
		id: makeId("report", `${handoffId || ""}:${summary}`),
	})
}
