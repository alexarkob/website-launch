import { useEffect, useState } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/** iOS Safari: Mouse + delayed Touch, never PointerSensor (fights scroll). */
export function useSoftballDndSensors() {
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setAutoScroll(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return { sensors, autoScroll };
}
