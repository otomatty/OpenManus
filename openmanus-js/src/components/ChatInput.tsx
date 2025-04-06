import type React from "react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
	onSendMessage: (message: string) => void;
	isProcessing: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
	onSendMessage,
	isProcessing,
}) => {
	const [message, setMessage] = useState("");

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		if (message.trim() && !isProcessing) {
			onSendMessage(message);
			setMessage("");
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="mt-4">
			<div className="relative flex items-center">
				<textarea
					className="w-full p-3 pr-12 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-400
								bg-white text-neutral-900 border-neutral-300
								dark:bg-neutral-800 dark:text-neutral-50 dark:border-neutral-700
								disabled:bg-neutral-100 dark:disabled:bg-neutral-900 disabled:text-neutral-500 dark:disabled:text-neutral-400"
					placeholder="メッセージを入力..."
					rows={3}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={isProcessing}
				/>
				<button
					type="submit"
					disabled={!message.trim() || isProcessing}
					aria-label="メッセージを送信"
					className={`absolute right-2 p-2 rounded-full transition-colors ${
						!message.trim() || isProcessing
							? "text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
							: "text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900 dark:text-primary-400"
					}`}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						className="w-6 h-6"
						aria-hidden="true"
					>
						<path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
					</svg>
				</button>
			</div>
			{isProcessing && (
				<div className="mt-2 text-sm text-center text-neutral-500 dark:text-neutral-400">
					処理中...
				</div>
			)}
		</form>
	);
};
