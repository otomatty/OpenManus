"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { type Message, MessageRole } from "@/lib/agent/types";
import type { AgentProgress } from "@/lib/agent/base";
import { ChatWindow } from "@/components/ChatWindow";
import { AgentMemory } from "@/lib/agent/memory";

export default function Home() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const currentAssistantMessageId = useRef<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);

	const addOrUpdateAssistantMessage = (
		content: string,
		id: string | null = null,
	) => {
		setMessages((prev) => {
			const newId = id || `temp-${Date.now()}`;
			const existingIndex = prev.findIndex((msg) => msg.tool_call_id === newId);
			if (existingIndex > -1) {
				const updatedMessages = [...prev];
				updatedMessages[existingIndex] = {
					...updatedMessages[existingIndex],
					content,
				};
				return updatedMessages;
			}
			currentAssistantMessageId.current = newId;
			const newMessage: Message = {
				role: MessageRole.ASSISTANT,
				content: content,
				tool_call_id: newId,
			};
			return [...prev, newMessage];
		});
	};

	const handleSendMessage = async (content: string) => {
		if (isProcessing) return;

		const userMessage = AgentMemory.userMessage(content);
		setMessages((prev) => [...prev, userMessage]);
		setIsProcessing(true);
		currentAssistantMessageId.current = null;
		addOrUpdateAssistantMessage("思考中...", `temp-${Date.now()}`);

		try {
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ message: content, sessionId: "default" }),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}
			if (!response.body) {
				throw new Error("API response body is null");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let receivedFinalResponse = false;

			console.log("ストリーム処理開始");
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					console.log("ストリーム処理完了（ストリーム終了）");
					if (!receivedFinalResponse) {
						console.log("最終応答が受信されずにストリームが終了しました");
						// 最終応答がなかった場合、最終メッセージを更新
						addOrUpdateAssistantMessage(
							"応答の処理が完了しましたが、最終応答が届きませんでした。",
							currentAssistantMessageId.current,
						);
					}
					break;
				}

				// バイナリデータをテキストにデコード
				const chunk = decoder.decode(value, { stream: true });
				console.log("受信チャンク:", chunk);
				buffer += chunk;

				// イベントの区切り（空行2つ）を検出して処理
				let eventEndIndex: number = buffer.indexOf("\n\n");
				while (eventEndIndex !== -1) {
					const eventData = buffer.substring(0, eventEndIndex);
					buffer = buffer.substring(eventEndIndex + 2);

					console.log("イベントデータ:", eventData);
					if (eventData.startsWith("data: ")) {
						const jsonData = eventData.substring(6);
						try {
							const progress = JSON.parse(jsonData) as AgentProgress;
							console.log("解析済み進捗:", progress);

							// final_responseイベントを受信したら完了フラグをセット
							if (progress.type === "final_response") {
								receivedFinalResponse = true;
							}

							handleProgressUpdate(progress);
						} catch (e) {
							console.error("進捗JSONの解析に失敗:", e, jsonData);
						}
					}

					// 次のイベント区切りを検索
					eventEndIndex = buffer.indexOf("\n\n");
				}
			}
		} catch (error) {
			console.error("Error sending message:", error);
			addOrUpdateAssistantMessage(
				`エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
				currentAssistantMessageId.current,
			);
		} finally {
			console.log("メッセージ処理完了、状態リセット");
			setIsProcessing(false);
			currentAssistantMessageId.current = null;
		}
	};

	const handleProgressUpdate = (progress: AgentProgress) => {
		console.log("Progress Update:", progress);
		const { type, data } = progress;

		switch (type) {
			case "plan":
				addOrUpdateAssistantMessage(
					`計画を立てました:\n${(data as { steps: string[] }).steps.join("\n")}`,
					currentAssistantMessageId.current,
				);
				break;
			case "think":
				addOrUpdateAssistantMessage(
					`思考中... (ステップ ${(data as { step: number }).step})`,
					currentAssistantMessageId.current,
				);
				break;
			case "act_start": {
				const toolName = (data as { name: string }).name;
				const args = (data as { args: Record<string, unknown> }).args;
				addOrUpdateAssistantMessage(
					`ツール実行中: ${toolName} (${JSON.stringify(args)})`,
					currentAssistantMessageId.current,
				);
				break;
			}
			case "act_result": {
				const toolName = (data as { name: string }).name;
				const result = (data as { result: string }).result;
				// 結果が長すぎる場合は省略表示
				const displayResult =
					result.length > 500 ? `${result.substring(0, 500)}...(省略)` : result;

				addOrUpdateAssistantMessage(
					`ツール「${toolName}」の実行結果:\n${displayResult}`,
					currentAssistantMessageId.current,
				);
				break;
			}
			case "final_response": {
				// response または message フィールドを取得
				const response =
					(data as { response?: string; message?: string }).response ||
					(data as { response?: string; message?: string }).message ||
					"応答が生成されました";

				console.log(
					`最終応答を受信: ${response.substring(0, 100)}${response.length > 100 ? "..." : ""}`,
				);
				addOrUpdateAssistantMessage(
					response,
					currentAssistantMessageId.current,
				);
				break;
			}
			case "info": {
				const message = (data as { message: string }).message;
				console.log("情報メッセージ:", message);

				// 情報メッセージが「最終応答を生成中...」の場合、ユーザーに表示
				if (message.includes("最終応答") || message.includes("計画")) {
					addOrUpdateAssistantMessage(
						message,
						currentAssistantMessageId.current,
					);
				}
				break;
			}
			case "error": {
				const message = (data as { message: string }).message;
				const details = (data as { details?: unknown }).details;

				// ツール呼び出しが見つからないケースは情報メッセージとして処理
				if (message.includes("実行するツール呼び出しが見つかりません")) {
					console.log("情報: ツールの実行は不要です。直接応答します。");
					// UIには表示しない、または情報として表示
					// addOrUpdateAssistantMessage(
					// 	`情報: 直接応答します`,
					// 	currentAssistantMessageId.current,
					// );
				} else {
					// 本当のエラーの場合
					console.error("エラー発生:", message, details);
					addOrUpdateAssistantMessage(
						`エラー: ${message}`,
						currentAssistantMessageId.current,
					);
				}
				break;
			}
			default:
				console.log("未処理の進捗タイプ:", type, data);
				break;
		}
	};

	useEffect(() => {
		// This is a placeholder for any additional effects you might want to add
	}, []);

	return (
		<div className="flex flex-col h-screen">
			<header className="bg-blue-600 text-white p-4 shadow-md">
				<h1 className="text-xl font-bold">OpenManus JS</h1>
				<div className="flex space-x-4">
					<Link href="/" className="hover:underline">
						チャット
					</Link>
					<Link href="/agent" className="hover:underline">
						エージェント
					</Link>
				</div>
			</header>

			<main className="flex-1 overflow-hidden flex flex-col p-4">
				<div className="flex-1 overflow-hidden">
					<ChatWindow
						messages={messages}
						isProcessing={isProcessing}
						messagesEndRef={messagesEndRef}
						onSendMessage={handleSendMessage}
					/>
				</div>
			</main>
		</div>
	);
}
