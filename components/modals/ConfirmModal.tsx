"use client";

import { useRef } from "react";
import ModalWrapper from "./ModalWrapper";
import Button from "@/components/ui/Button";

interface ConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title?: string;
	message: string;
}

export default function ConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	title = "Confirm",
	message,
}: ConfirmModalProps) {
	const confirmButtonRef = useRef<HTMLButtonElement>(null);

	const handleConfirm = () => {
		onConfirm();
		onClose();
	};

	return (
		<ModalWrapper
			isOpen={isOpen}
			onClose={onClose}
			backdropClassName="fixed inset-0 bg-black z-[80]"
			modalClassName="fixed inset-0 z-[90] flex items-center justify-center p-4"
			ariaLabel={title}
			initialFocusRef={confirmButtonRef}>
			<div className="bg-[var(--color-surface)] rounded-lg shadow-xl max-w-md w-full p-6 border border-[var(--color-border)]">
				<h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
					{title}
				</h2>
				<p className="text-[var(--color-text-primary)]/80 mb-6">
					{message}
				</p>
				<div className="flex gap-3 justify-end">
					<Button
						variant="secondary"
						size="md"
						onClick={onClose}
						type="button">
						Cancel
					</Button>
					<Button
						ref={confirmButtonRef}
						variant="primary"
						size="md"
						onClick={handleConfirm}
						type="button">
						OK
					</Button>
				</div>
			</div>
		</ModalWrapper>
	);
}
