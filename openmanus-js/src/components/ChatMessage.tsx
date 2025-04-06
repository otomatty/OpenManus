import type React from "react";
import ReactMarkdown from "react-markdown";
import { MessageRole } from "@/lib/agent/types";

interface ChatMessageProps {
	role: MessageRole;
	content: string;
	base64Image?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
	role,
	content,
	base64Image,
}) => {
	const isUser = role === MessageRole.USER;

	return (
		<div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
			<div
				className={`max-w-[80%] rounded-lg px-4 py-3 ${
					isUser
						? "bg-amber-100 text-primary dark:bg-primary-700"
						: "bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-50 border border-neutral-200 dark:border-neutral-600"
				}`}
			>
				<div className="text-sm font-bold mb-1">
					{isUser ? "あなた" : "OpenManus"}
				</div>

				<div className="prose dark:prose-invert prose-sm max-w-none">
					<ReactMarkdown>{content}</ReactMarkdown>
				</div>

				{base64Image && (
					<div className="mt-2">
						<img
							src={`data:image/png;base64,${base64Image}`}
							alt="Generated content"
							className="max-w-full rounded-md border border-neutral-200 dark:border-neutral-600"
						/>
					</div>
				)}
			</div>
		</div>
	);
};
