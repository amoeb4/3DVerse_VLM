import { Fragment, useState } from "react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetTrigger,
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
import { useMediaQuery } from "../hooks/useMediaQuery";

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
      { setting: "outlines", label: "Edge outlines", icon: "fa-border-none" },
      { setting: "grid", label: "Floor grid", icon: "fa-table-cells" },
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
 * Below `lg`, the same options come up in a sheet from the bottom of the screen (`BottomSheet`).
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
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      active={isOpen}
      title="View: what the 3D view shows"
      aria-label="View"
      className="pl-5 md:pl-0"
    />
  );
  const eye = (
    <Icon
      className={cn(
        "fas text-2xs",
        anyShown ? "fa-eye" : "fa-eye-slash opacity-60",
      )}
    />
  );
  const cellHiddenReason = "The cell is not shown in this mode";

  if (!isLargeScreen) {
    return (
      <BottomSheet open={isOpen} onOpenChange={setIsOpen}>
        <BottomSheetTrigger render={trigger}>{eye}</BottomSheetTrigger>
        <BottomSheetContent
          showOverlay={false}
          className="max-h-[80dvh] sm:max-w-xl"
        >
          <BottomSheetTitle className="mb-2">View</BottomSheetTitle>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {GROUPS.map((group) => (
              <section key={group.label} className="mb-2">
                <h3 className="px-3 py-1.5 text-3xs text-tertiary">
                  {group.label}
                </h3>
                {group.items.map((item) => (
                  <ViewSheetRow
                    key={item.setting}
                    icon={item.icon}
                    label={item.label}
                    checked={view[item.setting]}
                    disabledReason={
                      item.ofTheCell && cellHidden
                        ? cellHiddenReason
                        : undefined
                    }
                    onClick={() => onToggle(item.setting)}
                  />
                ))}
              </section>
            ))}
            <div className="pt-2 border-t border-tertiary/40">
              <ViewSheetRow
                icon={theme === "dark" ? "fa-sun" : "fa-moon"}
                label={theme === "dark" ? "Light theme" : "Dark theme"}
                disabledReason={
                  theme ? undefined : "The theme is not known yet"
                }
                onClick={onToggleTheme}
              />
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  return (
    <Menu open={isOpen} onOpenChange={setIsOpen}>
      <MenuTrigger render={trigger}>{eye}</MenuTrigger>

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
                    item.ofTheCell && cellHidden ? cellHiddenReason : undefined
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

/**
 * One of the sheet's options, a row the height of a finger. `checked`: a setting, ticked while on;
 * left out for an action (the theme).
 */
function ViewSheetRow({
  icon,
  label,
  checked,
  disabledReason,
  onClick,
}: {
  icon: string;
  label: string;
  checked?: boolean;
  /** Why it is unavailable, when it is. */
  disabledReason?: string;
  onClick: () => void;
}) {
  const isSetting = checked !== undefined;
  return (
    <button
      type="button"
      role={isSetting ? "switch" : undefined}
      aria-checked={isSetting ? checked : undefined}
      disabled={Boolean(disabledReason)}
      title={disabledReason}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full min-h-11 px-3 rounded-lg text-left text-sm cursor-pointer",
        "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-300",
        "active:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed",
        isSetting && !checked && "text-tertiary",
      )}
    >
      <Icon className={cn("fas w-4 text-center text-secondary", icon)} />
      {label}
      {isSetting && (
        <Icon
          className={cn(
            "fas fa-check ml-auto text-accent-300",
            !checked && "invisible",
          )}
        />
      )}
    </button>
  );
}
