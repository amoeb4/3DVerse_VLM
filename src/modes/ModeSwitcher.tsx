import { MainNavbar, MainNavbarItem } from "../components/common";
import { MODE_SHORTCUTS } from "../shortcuts/shortcuts";
import { MODES, type ViewMode } from "./modes";
import { triggerHapticFeedback } from "../utils/haptics";

type NavEntry = {
  label: string;
  /** A Font Awesome icon class, without the `fas` prefix. */
  icon: string;
  description: string;
  /** The mode it opens; none for an entry not built yet, shown disabled as the roadmap. */
  mode: ViewMode | null;
  /** The modes it stands lit in: Part and Assistance are views of Monitor. */
  activeIn: readonly ViewMode[];
};

const ENTRIES: readonly NavEntry[] = [
  {
    label: MODES.monitor.label,
    icon: MODES.monitor.icon,
    description: MODES.monitor.description,
    mode: "monitor",
    activeIn: ["monitor", "part"],
  },
  {
    label: MODES.assistance.label,
    icon: MODES.assistance.icon,
    description: MODES.assistance.description,
    mode: "assistance",
    activeIn: ["assistance"],
  },
  {
    label: "Security",
    icon: "fa-shield-halved",
    description: "Safety of the cell and of who works at it",
    mode: null,
    activeIn: [],
  },
  {
    label: "Documentation",
    icon: "fa-book",
    description: "The cell's manuals, procedures and drawings",
    mode: null,
    activeIn: [],
  },
  {
    label: MODES.training.label,
    icon: MODES.training.icon,
    description: MODES.training.description,
    mode: "training",
    activeIn: ["training"],
  },
];

/**
 * The viewer's main sections, docked at the bottom centre of the screen: Monitor (with Part, opened
 * from it), Diagnostic (the `assistance` mode), Security and Documentation (not built yet, disabled), and Training.
 * Below `md`, the ones not built yet are left out: on a phone, only what opens.
 */
export function ModeSwitcher({
  mode,
  onSelect,
}: {
  mode: ViewMode;
  onSelect: (mode: ViewMode) => void;
}) {
  return (
    <MainNavbar aria-label="Sections">
      {ENTRIES.map((entry) => {
        const target = entry.mode;
        return (
          <MainNavbarItem
            key={entry.label}
            icon={entry.icon}
            label={entry.label}
            isActive={entry.activeIn.includes(mode)}
            disabled={!target}
            className={target ? undefined : "max-md:hidden"}
            title={
              target
                ? `${entry.label} (${MODE_SHORTCUTS[target]}): ${entry.description}`
                : `${entry.label}: coming soon. ${entry.description}`
            }
            onClick={() => {
              if (target) {
                triggerHapticFeedback();
                onSelect(target);
              }
            }}
          />
        );
      })}
    </MainNavbar>
  );
}
