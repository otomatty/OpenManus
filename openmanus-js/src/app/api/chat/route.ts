import { type NextRequest, NextResponse } from "next/server";
import { GeminiAPI } from "@/lib/gemini/api";
import { Config } from "@/lib/config";
import { ToolAgent } from "@/lib/agent/tool-agent";
import type { BaseAgent } from "@/lib/agent/base";
import type { ProgressCallback } from "@/lib/agent/base";

// セッション管理 (簡易的なインメモリ実装)
const agentSessions: Record<string, BaseAgent> = {};

/**
 * エージェントを取得または作成するヘルパー関数
 * ストリーミング用に onProgress コールバックを受け取るように変更
 */
function getOrCreateAgent(
	sessionId: string,
	apiKey: string,
	onProgress: ProgressCallback,
): BaseAgent {
	if (!agentSessions[sessionId]) {
		console.log(`Creating new agent for session: ${sessionId}`);
		const config = Config.getInstance({
			llm: {
				apiKey,
				// 環境変数からモデルを読み込む
				model: process.env.LLM_MODEL || "gemini-2.0-flash",
				temperature: Number.parseFloat(process.env.LLM_TEMPERATURE || "0.0"),
				maxOutputTokens: Number.parseInt(
					process.env.LLM_MAX_OUTPUT_TOKENS || "4096",
				),
			},
			maxSteps: Number.parseInt(process.env.MAX_STEPS || "10"), // 最大ステップ数を設定
		});
		console.log(`Using LLM Model: ${config.llm.model}`);
		const gemini = new GeminiAPI({
			apiKey,
			model: config.llm.model,
			temperature: config.llm.temperature,
			maxOutputTokens: config.llm.maxOutputTokens,
		});
		agentSessions[sessionId] = new ToolAgent(config, gemini, onProgress);
	} else {
		console.log(
			`Agent for session ${sessionId} already exists. Updating callback.`,
		);
		// 既存のエージェントのコールバックを更新
		(agentSessions[sessionId] as ToolAgent).updateProgressCallback(onProgress);
	}
	return agentSessions[sessionId];
}

// エージェントベースのストリーミングチャットAPIハンドラ
export async function POST(req: NextRequest) {
	const { message, sessionId = "default" } = await req.json();
	const apiKey = process.env.GEMINI_API_KEY;

	if (!apiKey) {
		return NextResponse.json(
			{ error: "Gemini API キーが設定されていません" },
			{ status: 500 },
		);
	}

	// ストリームを作成
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			// 進捗通知コールバックを定義
			const onProgress: ProgressCallback = (progress) => {
				// 進捗情報をJSON文字列にしてストリームに書き込む
				const chunk = `data: ${JSON.stringify(progress)}\n\n`;
				controller.enqueue(encoder.encode(chunk));
			};

			try {
				console.log("エージェント処理開始:", { message, sessionId });

				// エージェントを取得または作成 (onProgress を渡す)
				const agent = getOrCreateAgent(sessionId, apiKey, onProgress);

				// エージェントを実行 (run は最終結果を待つ)
				await agent.run(message);

				console.log("エージェント処理完了");

				// 実行完了後、ストリームを閉じる
				controller.close();
			} catch (error) {
				console.error("エージェントストリーム処理エラー:", error);

				// エラー詳細をJSONとしてシリアライズ
				let errorDetails: string | Record<string, unknown>;
				if (error instanceof Error) {
					errorDetails = {
						name: error.name,
						message: error.message,
						stack: error.stack,
					};
				} else {
					errorDetails = String(error);
				}

				// エラー情報をクライアントに送信
				const errorProgress = {
					type: "error",
					data: {
						message: `エージェント実行中にエラー: ${error instanceof Error ? error.message : String(error)}`,
						details: errorDetails,
					},
				};
				const chunk = `data: ${JSON.stringify(errorProgress)}\n\n`;
				controller.enqueue(encoder.encode(chunk));
				controller.close(); // エラー発生時もストリームを閉じる
			}
		},
	});

	// ストリームをレスポンスとして返す (Content-Type を text/event-stream に設定)
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}

// 既存のGETハンドラは不要になるか、別の用途にする
// export async function GET(req: NextRequest) { ... }
