"use client";

import React, { useState } from "react";
import Link from "next/link";
import { type Message, MessageRole } from "@/lib/agent/types";
import { ChatWindow } from "@/components/ChatWindow";
import { AgentMemory } from "@/lib/agent/memory";

export default function Home() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);

	const handleSendMessage = async (content: string) => {
		if (isProcessing) return;

		// ユーザーメッセージを追加
		const userMessage = AgentMemory.userMessage(content);
		setMessages((prev) => [...prev, userMessage]);
		setIsProcessing(true);

		try {
			// APIに送信
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: content,
					systemPrompt:
						"あなたはOpenManusという高性能AIアシスタントです。ユーザーからの質問に丁寧に回答してください。",
				}),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data = await response.json();

			// アシスタントの応答を追加
			const assistantMessage = AgentMemory.assistantMessage(data.response);
			setMessages((prev) => [...prev, assistantMessage]);
		} catch (error) {
			console.error("Error sending message:", error);

			// エラーメッセージを追加
			const errorMessage: Message = {
				role: MessageRole.ASSISTANT,
				content: `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
			};
			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<main className="flex min-h-screen flex-col items-center bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
			<header className="w-full bg-primary-600 text-primary p-4 flex justify-between items-center shadow-md">
				<h1 className="text-xl font-bold">OpenManus</h1>
				<nav>
					<Link
						href="/agent"
						className="bg-primary-700 hover:bg-primary-800 text-primary px-4 py-2 rounded-md transition-colors"
					>
						ツールエージェント
					</Link>
				</nav>
			</header>

			<div className="flex-1 w-full max-w-4xl p-4">
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
