import { type NextRequest, NextResponse } from "next/server";
import { Config } from "@/lib/config";
import { GeminiAPI } from "@/lib/gemini/api";
import { ToolAgent } from "@/lib/agent/tool-agent";

// セッション管理（実際のアプリケーションではRedisなどを使うべき）
const sessions: Record<string, ToolAgent> = {};

export async function POST(req: NextRequest) {
	try {
		const { message, sessionId = "default" } = await req.json();

		// APIキーの確認
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ error: "Gemini API キーが設定されていません" },
				{ status: 500 },
			);
		}

		// 設定とGemini APIクライアントを初期化
		const config = Config.getInstance({
			llm: {
				apiKey,
				model: "gemini-2.0-flash",
				temperature: 0.0,
				maxOutputTokens: 4096,
			},
		});

		const gemini = new GeminiAPI({
			apiKey,
			model: config.llm.model,
			temperature: config.llm.temperature,
			maxOutputTokens: config.llm.maxOutputTokens,
		});

		// セッションからエージェントを取得または新規作成
		let agent = sessions[sessionId];
		if (!agent) {
			agent = new ToolAgent(config, gemini);
			sessions[sessionId] = agent;
		}

		// エージェントでメッセージを処理
		const result = await agent.run(message);

		// レスポンスとして現在のメッセージ履歴を返す
		return NextResponse.json({
			sessionId,
			messages: agent.memory.getMessages(),
			result,
		});
	} catch (error) {
		console.error("エージェントAPI処理エラー:", error);
		return NextResponse.json(
			{
				error: `リクエスト処理に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
			},
			{ status: 500 },
		);
	}
}

// セッション情報を取得
export async function GET(req: NextRequest) {
	try {
		const url = new URL(req.url);
		const sessionId = url.searchParams.get("sessionId") || "default";

		if (!sessions[sessionId]) {
			return NextResponse.json(
				{ error: "セッションが見つかりません" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			sessionId,
			messages: sessions[sessionId].memory.getMessages(),
		});
	} catch (error) {
		console.error("セッション取得エラー:", error);
		return NextResponse.json(
			{
				error: `セッション情報の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
			},
			{ status: 500 },
		);
	}
}

// セッションをクリア
export async function DELETE(req: NextRequest) {
	try {
		const url = new URL(req.url);
		const sessionId = url.searchParams.get("sessionId") || "default";

		if (sessions[sessionId]) {
			await sessions[sessionId].cleanup();
			delete sessions[sessionId];
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("セッション削除エラー:", error);
		return NextResponse.json(
			{
				error: `セッションの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
			},
			{ status: 500 },
		);
	}
}
