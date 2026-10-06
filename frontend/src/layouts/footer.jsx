// omzig.ai overlay: brand footer. CyberDrain attribution and the AGPL-3.0
// notice stay put — upstream's licence requires them.
import { Container, Typography } from "@mui/material";
import { OMZIG_TAGLINE, OMZIG_WORDMARK_FULL } from "../omzig/branding/palette";

export const Footer = () => {
  return (
    <div>
      <Container
        maxWidth="xl"
        sx={{
          display: "flex",
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          py: 1,
          "& a": {
            mt: {
              xs: 1,
              sm: 0,
            },
            "&:not(:last-child)": {
              mr: {
                xs: 0,
                sm: 2,
              },
            },
          },
        }}
      >
        {/* Both lines previously carried opacity 0.75 / 0.6, which quietly cut
            them to 5.74:1 and 2.95:1 — the second failing even AA. Using
            text.secondary at full opacity keeps them AAA (9.40:1 dark,
            7.99:1 light) at the same visual weight. */}
        <Typography variant="caption" sx={{ fontSize: 12, color: "text.secondary" }}>
          {OMZIG_WORDMARK_FULL} — {OMZIG_TAGLINE}
        </Typography>
        <Typography
          variant="caption"
          sx={{ fontSize: 12, color: "text.secondary", ml: "auto" }}
        >
          Built on CIPP by CyberDrain (AGPL-3.0)
        </Typography>
      </Container>
    </div>
  );
};
