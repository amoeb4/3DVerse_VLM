import { Fragment, useState } from "react";
import {
  Button,
  cn,
  Icon,
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@3dverse/ui-lib";

import type { ViewSetting, ViewSettings } from "../hooks/useViewSettings";
import type { SceneTheme } from "../hooks/useSceneTheme";
import { SHORTCUTS } from "../shortcuts/shortcuts";

type ViewItem = {
  setting: ViewSetting;
  label: string;
  icon: string;
  /** Has no effect where the cell is not shown (`cellHidden`). */
  ofTheCell?: boolean;
};

type ViewGroup = { label: string; items: ViewItem[] };

/**
 * The menu's options, by where they are drawn: over the stream in this browser, or by 3dverse for
 * this viewer's camera (`useViewSettings`).
 */
const GROUPS: ViewGroup[] = [
  {
    label: "Over the 3D",
    items: [
      {
        setting: "holo",
        label: "Hologram HUD",
        icon: "fa-atom",
        ofTheCell: true,
      },
      {
        setting: "jointAngles",
        label: "Joint angles",
        icon: "fa-compass-drafting",
        ofTheCell: true,
      },
      { setting: "atmosphere", label: "Atmosphere", icon: "fa-smog" },
      // The blue glare and the sparks at the torch while it welds. Over the part too, in Part.
      {
        setting: "weldArc",
        label: "Arc light",
        icon: "fa-wand-magic-sparkles",
      },
    ],
  },
  {
    label: "Render · your view",
    items: [
      { setting: "outlines", label: "Edge outlines", icon: "fa-border-all" },
      { setting: "grid", label: "Floor grid", icon: "fa-border-all" },
    ],
  },
];

/** What the eye on the button says: something is drawn over or into the picture. */
const SHOWN_SETTINGS: ViewSetting[] = [
  "holo",
  "jointAngles",
  "atmosphere",
  "weldArc",
];

/**
 * What the cell's 3D view shows, in every mode (`useViewSettings`): an icon button, the eye shut
 * while nothing is drawn over the picture, for the secondary toolbar beside VR and AR. The menu
 * stays open while toggling, so several can be set in one go. `cellHidden`: the mode shows
 * something else than the cell (Part), so the options about the cell have no effect there and are
 * disabled. Last, after a divider, the theme (light or dark, `T`).
 *
 * It opens below its button, as `MenuContent` places it, and flips above it in the bottom corner.
 */
export function ViewMenu({
  view,
  onToggle,
  cellHidden = false,
  theme,
  onToggleTheme,
}: {
  view: ViewSettings;
  onToggle: (setting: ViewSetting) => void;
  cellHidden?: boolean;
  /** The scene's theme; `null` until it is known. */
  theme: SceneTheme | null;
  onToggleTheme: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const anyShown = SHOWN_SETTINGS.some((setting) => view[setting]);

  return (
    <Menu open={isOpen} onOpenChange={setIsOpen}>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            active={isOpen}
            title="View: what the 3D view shows"
            aria-label="View"
          />
        }
      >
        <Icon
          className={cn(
            "fas text-2xs",
            anyShown ? "fa-eye" : "fa-eye-slash opacity-60",
          )}
        />
      </MenuTrigger>

      <MenuContent size="sm" className="min-w-56 border border-tertiary">
        {GROUPS.map((group, index) => (
          <Fragment key={group.label}>
            {index > 0 && <MenuSeparator className="bg-tertiary/20" />}
            <MenuGroup>
              <MenuGroupLabel>{group.label}</MenuGroupLabel>
              {group.items.map((item) => (
                <ViewMenuItem
                  key={item.setting}
                  {...item}
                  checked={view[item.setting]}
                  onToggle={() => onToggle(item.setting)}
                  disabledReason={
                    item.ofTheCell && cellHidden
                      ? "The cell is not shown in this mode"
                      : undefined
                  }
                />
              ))}
            </MenuGroup>
          </Fragment>
        ))}
        <MenuSeparator className="bg-tertiary/20" />
        <MenuItem
          closeOnClick={false}
          disabled={!theme}
          title={`Theme (${SHORTCUTS.theme.toUpperCase()})`}
          onClick={onToggleTheme}
        >
          <Icon
            className={cn(
              "text-secondary fas",
              theme === "dark" ? "fa-sun" : "fa-moon",
            )}
          />
          {theme === "dark" ? "Light theme" : "Dark theme"}
          <span className="ml-auto text-5xs text-tertiary uppercase">
            {SHORTCUTS.theme}
          </span>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function ViewMenuItem({
  label,
  icon,
  checked,
  onToggle,
  disabledReason,
}: ViewItem & {
  checked: boolean;
  onToggle: () => void;
  /** Why it is unavailable, when it is. */
  disabledReason?: string;
}) {
  return (
    <MenuItem
      closeOnClick={false}
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={Boolean(disabledReason)}
      title={disabledReason}
      onClick={onToggle}
      className={
        checked
          ? ""
          : "text-tertiary opacity-80 hover:text-primary hover:opacity-100"
      }
    >
      <Icon className={cn("text-secondary fas", icon)} />
      {label}
      <Icon
        className={cn(
          "fas fa-check ml-auto text-accent-300",
          !checked && "invisible",
        )}
      />
    </MenuItem>
  );
}
