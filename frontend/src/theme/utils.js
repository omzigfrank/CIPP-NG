import { blue, orange, indigo, purple, omzig } from "./colors";

export const getPrimary = (preset) => {
  switch (preset) {
    case "blue":
      return blue;
    case "orange":
      return orange;
    case "indigo":
      return indigo;
    case "purple":
      return purple;
    // omzig.ai overlay: brand preset (see src/omzig/README.md).
    case "omzig":
      return omzig;
    default:
      console.error(
        'Invalid color preset, accepted values: "blue", "orange", "indigo", "purple" or "omzig".'
      );
      return indigo;
  }
};
