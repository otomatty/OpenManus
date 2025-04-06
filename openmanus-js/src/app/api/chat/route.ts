import { type NextRequest, NextResponse } from "next/server";
import { GeminiAPI } from "@/lib/gemini/api";
import { Config } from "@/lib/config";
import { AgentMemory } from "@/lib/agent/memory";

// シンプルなチャットAPIハンドラ
export async function POST(req: NextRequest) {
	try {
		const { message, systemPrompt } = await req.json();

		// Gemini API キーを確認
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

		// メッセージをGeminiに送信
		const response = await gemini.chat(message, systemPrompt);

		// ユーザーメッセージとアシスタントレスポンスを作成
		const userMessage = AgentMemory.userMessage(message);
		const assistantMessage = AgentMemory.assistantMessage(response);

		return NextResponse.json({
			response,
			messages: [userMessage, assistantMessage],
		});
	} catch (error) {
		console.error("チャットAPI処理エラー:", error);
		return NextResponse.json(
			{
				error: `リクエスト処理に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
			},
			{ status: 500 },
		);
	}
}

// ストリーミングAPIハンドラ
export async function GET(req: NextRequest) {
	try {
		const searchParams = new URL(req.url).searchParams;
		const message = searchParams.get("message");
		const systemPrompt = searchParams.get("systemPrompt");

		if (!message) {
			return NextResponse.json(
				{ error: "メッセージパラメータが必要です" },
				{ status: 400 },
			);
		}

		// Gemini API キーを確認
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ error: "Gemini API キーが設定されていません" },
				{ status: 500 },
			);
		}

		// Gemini APIクライアントを初期化
		const gemini = new GeminiAPI({
			apiKey,
			model: "gemini-pro",
			temperature: 0.0,
			maxOutputTokens: 4096,
		});

		// ストリーミングレスポンスを取得
		const stream = await gemini.streamChat(message, systemPrompt || undefined);

		// ストリームをクライアントに返す
		return new NextResponse(stream);
	} catch (error) {
		console.error("ストリーミングAPI処理エラー:", error);
		return NextResponse.json(
			{
				error: `ストリーミングリクエスト処理に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
			},
			{ status: 500 },
		);
	}
}
