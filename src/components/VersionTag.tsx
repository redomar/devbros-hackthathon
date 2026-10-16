const REPO_URL = "https://github.com/redomar/devbros-hackthathon";

/** Tiny grey build stamp so it's obvious which release a screen is running. */
export function VersionTag({ className = "" }: { className?: string }) {
  const commit = __APP_COMMIT__;
  return (
    <span className={`font-mono text-[11px] leading-none text-ink-muted/60 ${className}`} aria-label={`Version ${__APP_VERSION__}`}>
      <a href={`${REPO_URL}/releases/tag/v${__APP_VERSION__}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
        v{__APP_VERSION__}
      </a>
      {commit ? (
        <>
          {" · "}
          <a href={`${REPO_URL}/commit/${commit}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {commit}
          </a>
        </>
      ) : null}
    </span>
  );
}
