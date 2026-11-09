/**
 * The torch tip — the entity "Blank", child of part_6 — where weld beads are laid and the arc
 * burns. It exists in the NJ130 2.05 scene only. Its world scale is 1, so offsets on it are metres.
 */
export const TORCH_EUID = "3951d6d3-bd81-43ff-96b2-0356d0bc7912";

/**
 * The two tools on part_6's flange, in NJ130 2.05, as Training's tool buttons (`TorchExample`)
 * switch them: the Fronius welding torch ("pos_torche", its sub-scene) and the milling spindle
 * ("effecteur", in "00-0300 - Effecteur NJ130 Broche-ASM"). The cell welds: the torch is shown by
 * default, the spindle hidden (`useFroniusTorchByDefault`).
 */
export const FRONIUS_TORCH_EUID = "63f5da3b-fcae-41b2-b615-b6ca73e8efc2";
export const MILLING_SPINDLE_EUID = "5c74d5c0-f601-4756-8b85-3bb55538b49e";
