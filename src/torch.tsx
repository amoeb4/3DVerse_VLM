import { Entity } from "@3dverse/livelink";
import { useEntity } from "@3dverse/livelink-react";
import { Button } from "@3dverse/ui-lib";

function toggleEntity(entity?: Entity | null, entity2?: Entity| null) {
  if (entity && entity == entity2)
  {
    entity.is_visible = !entity.is_visible; return;
}
  if (entity2)
    entity2.is_visible = !entity2.is_visible;
  if (entity)
    entity.is_visible = !entity.is_visible;
  if (entity2)
  entity2.is_visible = !entity2.is_visible;
}

export default function TorchExample() {
  const { entity: flame } = useEntity({ euid: "103acb9d-8d29-4281-ba7a-15b0114ffbcf" });
  const { entity: fronius } = useEntity({ euid: "63f5da3b-fcae-41b2-b615-b6ca73e8efc2" });
  const { entity: effecteur } = useEntity({ euid: "5c74d5c0-f601-4756-8b85-3bb55538b49e" });

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleEntity(flame, flame)}
      >
        Toggle flame
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleEntity(fronius, effecteur)}
      >
        Fronius torch
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleEntity(effecteur, fronius)}
      >
        Milling spindle
      </Button>
    </div>
  );
}
