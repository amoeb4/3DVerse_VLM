interface Scene {
  scene_id: string;
  name: string;
}

interface DropDownProps {
  scenes: Scene[];
  selectedSceneId: string | null;
  setSceneId: (id: string) => void;
}

export default function DropDown({
  scenes,
  selectedSceneId,
  setSceneId,
}: DropDownProps) {
  return (
    <div className="absolute bottom-4 flex items-center justify-center w-full">
      <select
        className="select select-primary min-w-[20rem]"
        value={selectedSceneId || ""}
        onChange={(event) => setSceneId(event.target.value)}
      >
        <option value="" disabled>
          Pick a scene
        </option>
        {scenes.map((item, i) => (
          <option key={i} value={item.scene_id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}
