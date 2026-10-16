import type { PublicState } from "../lib/useEvent";
import { Card } from "./ui";
import { CrownIcon, Initials, LevelPill } from "./People";
import { membersOf, teamSymbol } from "./TeamCard";
import { teamStyle } from "./teamStyle";

export function MyTeam({ state, participantId }: { state: PublicState; participantId: string }) {
  const team = state.teams.find((t) => t.memberIds.includes(participantId as never));
  if (!team) return null;
  const style = teamStyle(team.key);
  const amCaptain = team.captainId === participantId;
  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-4 text-white ${style.bg}`}>
        <div className="text-sm font-semibold opacity-85">You're in</div>
        <div className="font-display text-2xl font-bold">
          {teamSymbol(team.key)} {team.name}
        </div>
      </div>
      {amCaptain ? (
        <div className="flex items-center gap-2 bg-gold-soft px-5 py-3 font-semibold">
          <CrownIcon className="size-5 text-gold" /> You were drawn as captain. Lead with excellence!
        </div>
      ) : null}
      <ul className="flex flex-col gap-2 p-4">
        {membersOf(team, state.participants).map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Initials name={p.firstName} className={`size-10 text-sm ${style.soft} ${style.text}`} tone="" />
            <span className="flex-1 font-semibold">
              {p.firstName}
              {p.id === participantId ? <span className="font-normal text-ink-muted"> (you)</span> : null}
            </span>
            {p.id === team.captainId ? <CrownIcon className="size-5 text-gold" /> : null}
            <span className="text-[13px]">
              <LevelPill level={p.experience} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
