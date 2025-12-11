"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface IOSSharePreviewModalProps {
	isOpen: boolean;
	imageDataUrl: string;
	onContinue: () => void;
	onClose: () => void;
	backgroundColor?: "yellow" | "green";
	onBackgroundColorChange?: (color: "yellow" | "green") => void;
	onRegenerateImage?: (color: "yellow" | "green") => void;
}

export default function IOSSharePreviewModal({
	isOpen,
	imageDataUrl,
	onContinue,
	onClose,
	backgroundColor = "yellow",
	onBackgroundColorChange,
	onRegenerateImage,
}: IOSSharePreviewModalProps) {
	const handleColorChange = (color: "yellow" | "green") => {
		onBackgroundColorChange?.(color);
		if (onRegenerateImage) {
			onRegenerateImage(color);
		}
	};
	return (
		<Transition show={isOpen} as={Fragment}>
			<Dialog as="div" className="relative z-[100]" onClose={onClose}>
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-200"
					leaveFrom="opacity-100"
					leaveTo="opacity-0">
					<div className="fixed inset-0 bg-black" />
				</Transition.Child>

				<div className="fixed inset-0 overflow-y-auto">
					<div className="flex min-h-full items-center justify-center p-4">
						<Transition.Child
							as={Fragment}
							enter="ease-out duration-300"
							enterFrom="opacity-0 scale-95"
							enterTo="opacity-100 scale-100"
							leave="ease-in duration-200"
							leaveFrom="opacity-100 scale-100"
							leaveTo="opacity-0 scale-95">
							<Dialog.Panel className="w-full max-w-full h-full flex flex-col items-center justify-center">
								{/* Image Preview */}
								<div className="flex-1 flex items-center justify-center w-full p-4">
									<img
										src={imageDataUrl}
										alt="Share preview"
										className="max-w-full max-h-full object-contain"
										style={{
											maxWidth: "100%",
											maxHeight: "calc(100vh - 200px)",
										}}
									/>
								</div>

								{/* Background Colour Selection */}
								{onBackgroundColorChange && (
									<div className="w-full max-w-md px-4 pb-3">
										<label className="block text-xs font-medium text-white mb-1.5 text-center">
											Background colour
										</label>
										<div className="flex gap-4 justify-center">
											<label className="flex items-center gap-1.5 cursor-pointer">
												<input
													type="radio"
													name="backgroundColor"
													value="yellow"
													checked={backgroundColor === "yellow"}
													onChange={() => handleColorChange("yellow")}
													className="w-3.5 h-3.5 text-dorkinians-yellow focus:ring-0 focus:ring-offset-0"
												/>
												<span className="text-white text-sm">Yellow</span>
											</label>
											<label className="flex items-center gap-1.5 cursor-pointer">
												<input
													type="radio"
													name="backgroundColor"
													value="green"
													checked={backgroundColor === "green"}
													onChange={() => handleColorChange("green")}
													className="w-3.5 h-3.5 text-dorkinians-green focus:ring-0 focus:ring-offset-0"
												/>
												<span className="text-white text-sm">Green</span>
											</label>
										</div>
									</div>
								)}

								{/* Buttons */}
								<div className="w-full max-w-md px-4 pb-8 space-y-3">
									<button
										onClick={onContinue}
										className="w-full px-6 py-3 bg-dorkinians-yellow hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors">
										Continue to share
									</button>
									<button
										onClick={onClose}
										className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors">
										Close
									</button>
								</div>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</div>
			</Dialog>
		</Transition>
	);
}
