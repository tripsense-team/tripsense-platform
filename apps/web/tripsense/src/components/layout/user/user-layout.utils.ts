export function isMapWorkspacePath(pathname: string): boolean {
  return (
    pathname === "/explore" ||
    pathname.startsWith("/explore/") ||
    pathname === "/places" ||
    pathname.startsWith("/places/")
  );
}

export function shouldDisableSidebarWidthTransition(pathname: string): boolean {
  const isChatWorkspace =
    pathname === "/chat" || pathname.startsWith("/chat/");

  return isChatWorkspace || isMapWorkspacePath(pathname);
}
