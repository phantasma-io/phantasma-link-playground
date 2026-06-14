"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Server renders false, client renders true - without a setState-in-effect. Lets us avoid a
// hydration mismatch on the theme-dependent icon while next-themes resolves the active theme.
const emptySubscribe = () => () => {};
function useMounted(): boolean {
	return useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false,
	);
}

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const mounted = useMounted();

	if (!mounted) {
		return <Button variant="ghost" size="icon" aria-label="Toggle theme" />;
	}
	const dark = resolvedTheme === "dark";
	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label="Toggle theme"
			onClick={() => setTheme(dark ? "light" : "dark")}
		>
			{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
		</Button>
	);
}
