import { Entity } from "@3dverse/livelink";
import { useEntity } from "@3dverse/livelink-react";

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
  <div className="flex flex-col gap-2">
    <button onClick={() => toggleEntity(flame, flame)}>Allumer/Éteindre flamme</button>
    <button onClick={() => toggleEntity(fronius, effecteur)}>Broche fronius</button>
    <button onClick={() => toggleEntity(effecteur, fronius)}>Broche de fraisage</button>
  </div>
  );
}