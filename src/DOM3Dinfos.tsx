import { DOM3DOverlay, DOMEntity, useEntity } from "@3dverse/livelink-react";
import type { EntityWithParentId } from "./partEntitiesContext";

interface Dom3DInfosProps {
  entitiesMap?: Map<string, EntityWithParentId>;
}

export default function Dom3DInfos({ entitiesMap }: Dom3DInfosProps) {
  const { entity: part_1 } = useEntity({
    euid: "91153236-a05e-4127-a1c0-49b5761c41e3",
  });
  const { entity: part_2 } = useEntity({
    euid: "ec221ded-08df-4bae-8982-bb47c82a0917",
  });
  const { entity: part_3 } = useEntity({
    euid: "32cda313-895a-42e1-a5f6-dd50e398c332",
  });
  const { entity: part_4 } = useEntity({
    euid: "96b43de7-3c72-4ae5-8d1f-b2137c50bc61",
  });
  const { entity: part_5 } = useEntity({
    euid: "ed84c3ff-3c7f-445a-a1ff-d531c8f47133",
  });
  const { entity: part_6 } = useEntity({
    euid: "1274b32e-4d37-41cb-ad2b-0ed4886bf918",
  });
  const { entity: part_7 } = useEntity({
    euid: "df0b0b6f-789d-46a4-be69-4def0f8e1494",
  });
  const { entity: part_8 } = useEntity({
    euid: "2276b2a3-8a16-4d42-934d-fee7376fab25",
  });
  return (
    <DOM3DOverlay>
      {
        <DOMEntity entity={part_1} anchor="right-bottom" scaleFactor={0.0014}>
          <Label>
            Base<SubLabel>Z axis</SubLabel>
          </Label>
        </DOMEntity>
      }

      {
        <DOMEntity entity={part_2} anchor="left-bottom" scaleFactor={0.0014}>
          <Label>
            Shoulder<SubLabel>X axis</SubLabel>
          </Label>
        </DOMEntity>
      }

      {
        <DOMEntity entity={part_3} anchor="right-bottom" scaleFactor={0.0014}>
          <Label>
            Elbow 1<SubLabel>Z axis</SubLabel>
          </Label>
        </DOMEntity>
      }

      {
        <DOMEntity entity={part_4} anchor="left-bottom" scaleFactor={0.0014}>
          <Label>
            Arm<SubLabel>Y axis</SubLabel>
          </Label>
        </DOMEntity>
      }

      {
        <DOMEntity entity={part_5} anchor="right-bottom" scaleFactor={0.0014}>
          <Label>
            Elbow 2<SubLabel>Z axis</SubLabel>
          </Label>
        </DOMEntity>
      }

      {
        <DOMEntity entity={part_6} anchor="right-top" scaleFactor={0.0014}>
          <Label>
            Elbow 3<SubLabel>X axis</SubLabel>
          </Label>
        </DOMEntity>
      }

      {
        <DOMEntity entity={part_7} anchor="right-top" scaleFactor={0.0014}>
          <Label>
            Positioner<SubLabel>Y axis</SubLabel>
          </Label>
        </DOMEntity>
      }

      {
        <DOMEntity entity={part_8} anchor="right-top" scaleFactor={0.0014}>
          <Label>
            Turntable<SubLabel>Y axis</SubLabel>
          </Label>
        </DOMEntity>
      }
    </DOM3DOverlay>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => {
  return (
    <p
      data-theme="dark"
      className="px-4 py-2 rounded-lg bg-underground/80 text-2xl text-primary font-medium backdrop-blur-md border border-tertiary"
    >
      {children}
    </p>
  );
};

const SubLabel = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="block text-[80%] font-normal opacity-80">{children}</span>
  );
};
