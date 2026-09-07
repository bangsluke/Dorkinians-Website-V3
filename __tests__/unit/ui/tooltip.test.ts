/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
	ChartTooltip,
	computeFloatingTooltipPosition,
	HoverTooltip,
	TOOLTIP_SURFACE_CLASS,
	TooltipSurface,
} from "@/components/ui/Tooltip";
import WeekDateTooltip from "@/components/ui/WeekDateTooltip";

describe("Tooltip surface", () => {
	test("renders the Form-chart shell classes and token background", () => {
		render(React.createElement(TooltipSurface, null, "Form rating"));

		const tooltip = screen.getByRole("tooltip");
		expect(tooltip.textContent).toBe("Form rating");
		expect(tooltip.className).toContain("rounded-lg");
		expect(tooltip.className).toContain("border-[var(--tooltip-border)]");
		expect(tooltip.className).toContain("text-xs");
		expect(tooltip.style.background).toBe("var(--tooltip-bg)");
		expect(TOOLTIP_SURFACE_CLASS).toContain("shadow-lg");
	});

	test("ChartTooltip stays hidden until Recharts marks it active", () => {
		const { rerender } = render(
			React.createElement(ChartTooltip, { active: false, payload: [{ name: "Goals", value: 4 }] }),
		);
		expect(screen.queryByRole("tooltip")).toBeNull();

		rerender(
			React.createElement(ChartTooltip, {
				active: true,
				label: "2024/25",
				payload: [{ name: "Goals", value: 4, color: "#E8C547" }],
			}),
		);

		const tooltip = screen.getByRole("tooltip");
		expect(tooltip.textContent).toContain("2024/25");
		expect(tooltip.textContent).toContain("Goals:");
		expect(tooltip.textContent).toContain("4");
	});

	test("WeekDateTooltip uses the shared surface instead of a native title", () => {
		render(React.createElement(WeekDateTooltip, { seasonWeek: "2016/17-37" }, "Week 37"));

		fireEvent.mouseEnter(screen.getByText("Week 37"));
		const tooltip = screen.getByRole("tooltip");
		expect(tooltip.textContent).toMatch(/Sat/);
		expect(tooltip.textContent).toMatch(/2016/);
		expect(tooltip.className).toContain("border-[var(--tooltip-border)]");
		expect(tooltip.className).toContain("whitespace-nowrap");
		expect(screen.getByText("Week 37").getAttribute("title")).toBeNull();
	});

	test("HoverTooltip renders shared surface on hover and skips wrapper when content is empty", () => {
		const { rerender } = render(
			React.createElement(HoverTooltip, { content: "Previous page" }, React.createElement("button", null, "Prev")),
		);

		expect(screen.queryByRole("tooltip")).toBeNull();
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Prev" }));

		const tooltip = screen.getByRole("tooltip");
		expect(tooltip.textContent).toBe("Previous page");
		expect(tooltip.className).toContain("border-[var(--tooltip-border)]");
		expect(tooltip.className).toContain("whitespace-nowrap");
		expect(screen.getByRole("button", { name: "Prev" }).getAttribute("title")).toBeNull();

		rerender(
			React.createElement(HoverTooltip, { content: "" }, React.createElement("button", null, "Prev")),
		);
		expect(screen.queryByRole("tooltip")).toBeNull();
	});

	test("computeFloatingTooltipPosition flips below when there is not enough space above", () => {
		const triggerRect = {
			top: 12,
			bottom: 36,
			left: 100,
			right: 140,
			width: 40,
			height: 24,
		} as DOMRect;

		const below = computeFloatingTooltipPosition({
			triggerRect,
			tooltipWidth: 120,
			tooltipHeight: 32,
			placement: "auto",
			viewportWidth: 400,
			viewportHeight: 800,
		});

		expect(below.resolvedPlacement).toBe("below");
		expect(below.top).toBeGreaterThan(triggerRect.bottom);

		const highTriggerRect = {
			top: 120,
			bottom: 144,
			left: 100,
			right: 140,
			width: 40,
			height: 24,
		} as DOMRect;

		const above = computeFloatingTooltipPosition({
			triggerRect: highTriggerRect,
			tooltipWidth: 120,
			tooltipHeight: 32,
			placement: "auto",
			viewportWidth: 400,
			viewportHeight: 800,
		});

		expect(above.resolvedPlacement).toBe("above");
		expect(above.top).toBeLessThan(highTriggerRect.top);
	});
});
