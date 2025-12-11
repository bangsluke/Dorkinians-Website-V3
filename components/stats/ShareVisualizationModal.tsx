"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export interface VisualizationOption {
	id: string;
	label: string;
	description?: string;
	available: boolean;
}

interface ShareVisualizationModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (visualizationId: string, backgroundColor: "yellow" | "green") => void;
	options: VisualizationOption[];
	backgroundColor?: "yellow" | "green";
	onBackgroundColorChange?: (color: "yellow" | "green") => void;
}

export default function ShareVisualizationModal({
	isOpen,
	onClose,
	onSelect,
	options,
	backgroundColor = "yellow",
	onBackgroundColorChange,
}: ShareVisualizationModalProps) {
	const availableOptions = options.filter(opt => opt.available);

	return (
		<Transition show={isOpen} as={Fragment}>
			<Dialog as="div" className="relative z-50" onClose={onClose}>
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-200"
					leaveFrom="opacity-100"
					leaveTo="opacity-100">
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
							<Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-[#0f0f0f] border border-white/20 p-4 shadow-xl transition-all">
								<div className="flex items-center justify-between mb-3">
									<Dialog.Title as="h3" className="text-lg font-bold text-dorkinians-yellow">
										Select Visualisation
									</Dialog.Title>
									<button
										onClick={onClose}
										className="text-white/70 hover:text-white transition-colors">
										<XMarkIcon className="h-5 w-5" />
									</button>
								</div>

								{/* Background Colour Selection */}
								<div className="mb-3 pb-3 border-b border-white/10">
									<label className="block text-xs font-medium text-white mb-1.5">
										Background colour
									</label>
									<div className="flex gap-4">
										<label className="flex items-center gap-1.5 cursor-pointer">
											<input
												type="radio"
												name="backgroundColor"
												value="yellow"
												checked={backgroundColor === "yellow"}
												onChange={() => onBackgroundColorChange?.("yellow")}
												className="w-3.5 h-3.5 text-dorkinians-yellow focus:ring-dorkinians-yellow focus:ring-2"
											/>
											<span className="text-white text-sm">Yellow</span>
										</label>
										<label className="flex items-center gap-1.5 cursor-pointer">
											<input
												type="radio"
												name="backgroundColor"
												value="green"
												checked={backgroundColor === "green"}
												onChange={() => onBackgroundColorChange?.("green")}
												className="w-3.5 h-3.5 text-dorkinians-green focus:ring-dorkinians-green focus:ring-2"
											/>
											<span className="text-white text-sm">Green</span>
										</label>
									</div>
								</div>

								<div className="space-y-1 max-h-[70vh] overflow-y-auto">
									{availableOptions.length === 0 ? (
										<p className="text-white/70 text-xs py-3 text-center">
											No visualizations available
										</p>
									) : (
										availableOptions.map((option) => (
											<button
												key={option.id}
												onClick={() => {
													onSelect(option.id, backgroundColor);
													onClose();
												}}
												className="w-full text-left p-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-dorkinians-yellow/50 transition-colors">
												<div className="font-medium text-sm text-white">
													{option.label}
												</div>
											</button>
										))
									)}
								</div>

								<div className="mt-3 flex justify-end">
									<button
										onClick={onClose}
										className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors">
										Cancel
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

