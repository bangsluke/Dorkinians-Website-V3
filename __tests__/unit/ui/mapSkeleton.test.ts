/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import MapSkeleton from "@/components/skeletons/MapSkeleton";

describe("MapSkeleton", () => {
	test("uses the same 320px viewport as the live opposition map", () => {
		const { container } = render(React.createElement(MapSkeleton));
		const viewport = container.querySelector("div.relative") as HTMLDivElement | null;
		expect(viewport).toBeTruthy();
		expect(viewport?.style.height).toBe("320px");
	});
});
