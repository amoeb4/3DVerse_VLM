import { Entity } from "@3dverse/livelink";
import { useEntity } from "@3dverse/livelink-react";
import { Button, cn, Icon } from "@3dverse/ui-lib";
import { ButtonGroup } from "./common/ButtonGroup";
import { IconSlashed } from "./common/IconSlashed";
import {
  FRONIUS_TORCH_EUID,
  HEAD_LIGHT_EUID,
  MILLING_SPINDLE_EUID,
} from "./weld/torch";

function toggleEntity(entity?: Entity | null, entity2?: Entity | null) {
  if (entity && entity == entity2) {
    entity.is_visible = !entity.is_visible;
    return;
  }
  if (entity2) entity2.is_visible = !entity2.is_visible;
  if (entity) entity.is_visible = !entity.is_visible;
  if (entity2) entity2.is_visible = !entity2.is_visible;
}

export default function TorchExample() {
  const { entity: flame } = useEntity({ euid: HEAD_LIGHT_EUID });
  const { entity: fronius } = useEntity({ euid: FRONIUS_TORCH_EUID });
  const { entity: effecteur } = useEntity({ euid: MILLING_SPINDLE_EUID });

  return (
    <ButtonGroup isAttached>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => toggleEntity(flame, flame)}
        className={cn(!flame?.is_visible && "text-tertiary/50")}
      >
        <IconSlashed slashed={!flame?.is_visible}>
          <Icon className="fas fa-fire" />
        </IconSlashed>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleEntity(fronius, effecteur)}
        className={cn(!fronius?.is_visible && "text-tertiary/50")}
      >
        Fronius torch
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleEntity(effecteur, fronius)}
        className={cn(!effecteur?.is_visible && "text-tertiary/50")}
      >
        Milling spindle
      </Button>
    </ButtonGroup>
  );
}
