"use client";

import React, { useState, useEffect } from "react";
import { type Message, MessageRole } from "@/lib/agent/types";
import { ChatWindow } from "@/components/ChatWindow";
import { AgentMemory } from "@/lib/agent/memory";

export default function AgentPage() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [sessionId, setSessionId] = useState<string>("default");
	const [error, setError] = useState<string | null>(null);

	// セッションをリセット
	const resetSession = async () => {
		try {
			setIsProcessing(true);
			const response = await fetch(`/api/agent?sessionId=${sessionId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			setMessages([]);
			setError(null);
		} catch (error) {
			console.error("Error resetting session:", error);
			setError(
				`セッションのリセットに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
			);
		} finally {
			setIsProcessing(false);
		}
	};

	// メッセージを送信
	const handleSendMessage = async (content: string) => {
		if (isProcessing) return;

		// ユーザーメッセージを追加
		const userMessage = AgentMemory.userMessage(content);
		setMessages((prev) => [...prev, userMessage]);
		setIsProcessing(true);
		setError(null);

		try {
			// APIに送信
			const response = await fetch("/api/agent", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: content,
					sessionId,
				}),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data = await response.json();

			// セッションIDを更新
			if (data.sessionId) {
				setSessionId(data.sessionId);
			}

			// メッセージを更新
			if (data.messages) {
				setMessages(data.messages);
			}
		} catch (error) {
			console.error("Error sending message:", error);

			// エラーメッセージを追加
			const errorMessage: Message = {
				role: MessageRole.ASSISTANT,
				content: `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
			};
			setMessages((prev) => [...prev, errorMessage]);
			setError(
				`メッセージの送信に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
			);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<main className="flex min-h-screen flex-col items-center bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
			<header className="w-full bg-primary-600 text-white p-4 flex justify-between items-center shadow-md">
				<div className="flex items-center">
					<h1 className="text-xl font-bold">OpenManus エージェント</h1>
					<span className="ml-2 text-xs bg-primary-700 px-2 py-1 rounded-full">
						セッションID: {sessionId}
					</span>
				</div>
				<button
					type="button"
					onClick={resetSession}
					disabled={isProcessing}
					className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
				>
					リセット
				</button>
			</header>

			<div className="flex-1 w-full max-w-4xl p-4">
				{error && (
					<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4 dark:bg-red-900 dark:border-red-800 dark:text-red-200">
						<p>{error}</p>
					</div>
				)}

				<div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg h-[calc(100vh-8rem)] border border-neutral-200 dark:border-neutral-700">
					<ChatWindow
						messages={messages}
						onSendMessage={handleSendMessage}
						isProcessing={isProcessing}
					/>
				</div>
			</div>
		</main>
	);
}
