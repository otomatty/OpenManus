import type React from "react";
import { useRef, useEffect } from "react";
import type { Message } from "@/lib/agent/types";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatWindowProps {
	messages: Message[];
	onSendMessage: (message: string) => void;
	isProcessing: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
	messages,
	onSendMessage,
	isProcessing,
}) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// 新しいメッセージが来たら自動スクロール
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-neutral-800">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-center text-neutral-500 dark:text-neutral-400">
							<h2 className="text-2xl font-bold mb-2">OpenManus</h2>
							<p>何でも質問してください！</p>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						{messages.map((message, index) => (
							<ChatMessage
								key={`msg-${message.tool_call_id || message.content}-${index}`}
								role={message.role}
								content={message.content || ""}
								base64Image={message.base64_image}
							/>
						))}
						<div ref={messagesEndRef} />
					</div>
				)}
			</div>
			<div className="border-t border-neutral-200 dark:border-neutral-700 p-4 bg-neutral-50 dark:bg-neutral-900">
				<ChatInput onSendMessage={onSendMessage} isProcessing={isProcessing} />
			</div>
		</div>
	);
};
