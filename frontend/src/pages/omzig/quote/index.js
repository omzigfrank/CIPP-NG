import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Divider,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Grid } from "@mui/system";
import { ExpandMore, LockOutlined, BoltOutlined } from "@mui/icons-material";
import { Layout as DashboardLayout } from "../../../layouts/index";
import { ApiGetCall, ApiPostCall } from "../../../api/ApiCall";
import { CippHead } from "../../../components/CippComponents/CippHead";
import { CippApiResults } from "../../../components/CippComponents/CippApiResults";
import {
  OMZIG_AI_PRODUCTS,
  OMZIG_COST_BASELINES,
  OmzigPageHero,
  omzigScale,
  omzigSemantic,
  RadialGauge,
  AnimatedNumber,
} from "../../../omzig";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatCurrency = (value) =>
  currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);

const formatPercent = (value) =>
  `${(Number.isFinite(Number(value)) ? Number(value) * 100 : 0).toFixed(1)}%`;

/** Compact product code, e.g. "AIRA" from "AIRA — AI Readiness Assessment". */
const productCode = (label) => (label || "").split(/[—-]/)[0].trim();

/** Big-number stat tile used in the preview and verdict panels. */
const StatTile = ({ label, value, accent, hint }) => (
  <Box
    sx={(theme) => ({
      borderRadius: 2,
      px: 2,
      py: 1.5,
      height: "100%",
      border: `1px solid ${
        accent ? alpha(accent, 0.35) : alpha(omzigScale[400], theme.palette.mode === "dark" ? 0.16 : 0.22)
      }`,
      backgroundColor:
        theme.palette.mode === "dark" ? alpha("#0E1523", 0.5) : alpha("#FFFFFF", 0.7),
      backgroundImage: accent
        ? `radial-gradient(120% 140% at 0% 0%, ${alpha(accent, 0.14)}, transparent 60%)`
        : "none",
    })}
  >
    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.8 }}>
      {label}
    </Typography>
    <Typography
      variant="h5"
      sx={{ fontVariantNumeric: "tabular-nums", ...(accent ? { color: accent } : {}) }}
    >
      {value}
    </Typography>
    {hint && (
      <Typography variant="caption" color="text.secondary">
        {hint}
      </Typography>
    )}
  </Box>
);

const Page = () => {
  const floors = ApiGetCall({
    url: "/api/ListOmzigPricingFloors",
    queryKey: "OmzigPricingFloors",
  });

  const evaluateQuote = ApiPostCall({
    relatedQueryKeys: ["OmzigPricingFloors"],
  });

  const [productId, setProductId] = useState("");
  const [price, setPrice] = useState("");
  const [techHours, setTechHours] = useState(0);
  const [vcioHours, setVcioHours] = useState(0);
  const [overrideToken, setOverrideToken] = useState("");

  // Reset the server evaluation whenever the inputs change so a stale
  // Approved/Refused verdict is never shown against a different quote.
  useEffect(() => {
    evaluateQuote.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, price, techHours, vcioHours, overrideToken]);

  const product = OMZIG_AI_PRODUCTS.find((p) => p.id === productId) || null;
  const serverFloor = floors.data?.find((f) => f.Id === productId) || null;
  const floorValue = serverFloor?.SmbFloor ?? product?.smbFloor ?? null;

  // Client-side preview only — mirrors the server math in
  // Test-OmzigQuoteFloor for instant feedback. The server's evaluation
  // (below) is always the authoritative verdict.
  const priceNumber = Number(price);
  const techHoursNumber = Number(techHours) || 0;
  const vcioHoursNumber = Number(vcioHours) || 0;
  const previewCost =
    techHoursNumber * OMZIG_COST_BASELINES.techLaborHourly +
    vcioHoursNumber * OMZIG_COST_BASELINES.vcioHourly;
  const previewMargin =
    Number.isFinite(priceNumber) && priceNumber > 0
      ? (priceNumber - previewCost) / priceNumber
      : null;
  const previewBelowFloor =
    Number.isFinite(priceNumber) &&
    priceNumber > 0 &&
    floorValue !== null &&
    priceNumber < floorValue;

  const canEvaluate = Boolean(productId) && Number.isFinite(priceNumber) && priceNumber > 0;

  const handleEvaluate = () => {
    evaluateQuote.mutate({
      url: "/api/ExecOmzigQuote",
      data: {
        productId,
        price: priceNumber,
        techHours: techHoursNumber,
        vcioHours: vcioHoursNumber,
        ...(overrideToken ? { overrideToken } : {}),
      },
    });
  };

  const result = evaluateQuote.isSuccess ? evaluateQuote.data?.data : null;
  const showAiraNeverDiscountedCopy =
    result && result.Approved === false && result.ProductId === "aira" && Boolean(overrideToken);

  const marginAccent =
    previewMargin === null
      ? undefined
      : previewMargin >= 0.7
        ? omzigSemantic.success
        : previewMargin >= 0.5
          ? omzigSemantic.warn
          : omzigSemantic.danger;

  const verdictColor = result
    ? result.Approved
      ? omzigSemantic.success
      : omzigSemantic.danger
    : null;

  return (
    <>
      <CippHead title="Quote Engine" noTenant />
      <Box sx={{ flexGrow: 1 }}>
        <Container maxWidth="lg">
          <Stack spacing={3}>
            <OmzigPageHero
              title="omzig.ai Quote Engine"
              subtitle="Evaluate an AI product quote against the §3 pricing floors and the 70% gross margin floor. Floors are hard — a below-floor quote is refused unless it carries a Frank-signed executive override."
            >
              {/* Live floor strip — click a product to load it into the quote. */}
              <Grid container spacing={1.5}>
                {(floors.data && Array.isArray(floors.data) ? floors.data : []).map((f) => {
                  const selected = f.Id === productId;
                  return (
                    <Grid key={f.Id} size={{ xs: 6, md: 3 }}>
                      <ButtonBase
                        onClick={() => setProductId(f.Id)}
                        sx={{
                          width: "100%",
                          height: "100%",
                          textAlign: "left",
                          display: "block",
                          borderRadius: 2,
                          px: 2,
                          py: 1.5,
                          border: `1px solid ${
                            selected ? alpha(omzigScale[300], 0.75) : alpha(omzigScale[300], 0.22)
                          }`,
                          backgroundColor: alpha("#0E1420", selected ? 0.7 : 0.45),
                          backdropFilter: "blur(12px)",
                          transition: "border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
                          boxShadow: selected
                            ? `0 0 22px -4px ${alpha(omzigScale[400], 0.65)}`
                            : "none",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            borderColor: alpha(omzigScale[300], 0.6),
                          },
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography
                            variant="subtitle2"
                            sx={{ color: selected ? "#FFFFFF" : alpha("#FFFFFF", 0.85) }}
                          >
                            {productCode(f.Name)}
                          </Typography>
                          {f.NeverDiscounted && (
                            <LockOutlined sx={{ fontSize: 14, color: alpha("#FFFFFF", 0.6) }} />
                          )}
                        </Stack>
                        <Typography
                          variant="h6"
                          sx={{ color: omzigScale[200], fontVariantNumeric: "tabular-nums" }}
                        >
                          {formatCurrency(f.SmbFloor)}
                          {f.Recurring && (
                            <Typography component="span" variant="caption" sx={{ color: alpha("#FFFFFF", 0.6) }}>
                              {" "}
                              /mo
                            </Typography>
                          )}
                        </Typography>
                        <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.55) }}>
                          {f.NeverDiscounted ? "Floor · never discounted" : "SMB floor"}
                        </Typography>
                      </ButtonBase>
                    </Grid>
                  );
                })}
              </Grid>
            </OmzigPageHero>

            {floors.isError && (
              <Alert severity="error">Unable to load the omzig.ai pricing floors.</Alert>
            )}

            {floors.isLoading ? (
              <Skeleton variant="rounded" height={420} />
            ) : (
              <Grid container spacing={2.5} alignItems="flex-start">
                {/* ---------- Quote composer ---------- */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Card>
                    <CardHeader
                      title="Compose quote"
                      subheader="Product, price and delivery hours — margin is computed live"
                    />
                    <CardContent>
                      <Stack spacing={3}>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              Product
                            </Typography>
                            <Select
                              fullWidth
                              size="small"
                              displayEmpty
                              value={productId}
                              onChange={(e) => setProductId(e.target.value)}
                            >
                              <MenuItem value="" disabled>
                                Select a product
                              </MenuItem>
                              {OMZIG_AI_PRODUCTS.map((p) => (
                                <MenuItem key={p.id} value={p.id}>
                                  {p.label}
                                </MenuItem>
                              ))}
                            </Select>
                            {product && (
                              <Typography variant="caption" color="text.secondary">
                                {product.purpose}
                              </Typography>
                            )}
                          </Grid>

                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              Price {product?.recurring ? "(monthly)" : ""}
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              placeholder="0.00"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                            />
                          </Grid>

                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              Tech hours
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={techHours}
                              onChange={(e) => setTechHours(e.target.value)}
                              slotProps={{ htmlInput: { min: 0, step: "0.5" } }}
                            />
                          </Grid>

                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              vCIO hours
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={vcioHours}
                              onChange={(e) => setVcioHours(e.target.value)}
                              slotProps={{ htmlInput: { min: 0, step: "0.5" } }}
                            />
                          </Grid>
                        </Grid>

                        <Accordion variant="outlined">
                          <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="body2">Executive override token</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <TextField
                              fullWidth
                              size="small"
                              type="password"
                              label="Executive override token"
                              // Audit #4: don't let the browser offer to save/autofill the token.
                              autoComplete="off"
                              slotProps={{ htmlInput: { autoComplete: "off", spellCheck: false } }}
                              helperText="Frank-signed override for a below-floor quote. AIRA can never be discounted, even with a valid token."
                              value={overrideToken}
                              onChange={(e) => setOverrideToken(e.target.value)}
                            />
                          </AccordionDetails>
                        </Accordion>

                        <Divider />

                        <Box>
                          <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            startIcon={<BoltOutlined />}
                            onClick={handleEvaluate}
                            disabled={!canEvaluate || evaluateQuote.isPending}
                            sx={{ width: { xs: "100%", sm: "auto" } }}
                          >
                            {evaluateQuote.isPending ? "Evaluating..." : "Evaluate quote"}
                          </Button>
                        </Box>

                        <CippApiResults apiObject={evaluateQuote} errorsOnly />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {/* ---------- Live analysis + server verdict ---------- */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Stack spacing={2.5}>
                    <Card>
                      <CardHeader
                        title="Live preview"
                        subheader="Client-side estimate — the server's evaluation is authoritative"
                        titleTypographyProps={{ variant: "subtitle1" }}
                      />
                      <CardContent>
                        {!product || !Number.isFinite(priceNumber) || priceNumber <= 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            Select a product and enter a price to see a preview.
                          </Typography>
                        ) : (
                          <Stack spacing={1.5}>
                            <Grid container spacing={1.5}>
                              <Grid size={{ xs: 6 }}>
                                <StatTile label="Estimated cost" value={formatCurrency(previewCost)} />
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <StatTile
                                  label="Gross margin"
                                  value={previewMargin === null ? "—" : formatPercent(previewMargin)}
                                  accent={marginAccent}
                                  hint="Target ≥ 70%"
                                />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <StatTile
                                  label="Pricing floor"
                                  value={floorValue !== null ? formatCurrency(floorValue) : "—"}
                                  hint={
                                    product?.recurring ? "Monthly · 12-month minimum term" : undefined
                                  }
                                />
                              </Grid>
                            </Grid>
                            {previewBelowFloor && (
                              <Alert severity="warning" variant="outlined">
                                Preview: price is below the {product.label} floor of{" "}
                                {formatCurrency(floorValue)}.
                              </Alert>
                            )}
                          </Stack>
                        )}
                      </CardContent>
                    </Card>

                    {/* Server verdict — authoritative */}
                    {result && (
                      <Card
                        data-omzig-motion
                        sx={{
                          position: "relative",
                          overflow: "hidden",
                          border: `1px solid ${alpha(verdictColor, 0.5)}`,
                          boxShadow: `0 0 0 1px ${alpha(verdictColor, 0.12)}, 0 0 34px -8px ${alpha(
                            verdictColor,
                            0.55
                          )}`,
                          animation: "omzigFadeUp 360ms ease both",
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            background: `radial-gradient(140% 90% at 50% -20%, ${alpha(
                              verdictColor,
                              0.16
                            )}, transparent 55%)`,
                          },
                        }}
                      >
                        <CardContent>
                          <Stack spacing={2}>
                            <Stack
                              direction="row"
                              spacing={1.5}
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Typography variant="h6">Server evaluation</Typography>
                              <Chip
                                label={result.Approved ? "Approved" : "Refused"}
                                color={result.Approved ? "success" : "error"}
                                sx={{ fontWeight: 700, fontSize: "1rem", px: 1 }}
                              />
                            </Stack>

                            <Stack alignItems="center" sx={{ py: 1 }}>
                              <RadialGauge
                                value={result.GrossMargin}
                                label="Gross margin"
                                sublabel="Floor 70%"
                                accent={result.GrossMargin >= 0.7 ? omzigSemantic.success : omzigSemantic.warn}
                              />
                            </Stack>

                            <Grid container spacing={1.5}>
                              <Grid size={{ xs: 6 }}>
                                <StatTile
                                  label="Cost"
                                  value={
                                    <AnimatedNumber value={result.Cost} format={formatCurrency} />
                                  }
                                />
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <StatTile
                                  label="Floor"
                                  value={
                                    <AnimatedNumber value={result.Floor} format={formatCurrency} />
                                  }
                                />
                              </Grid>
                              <Grid size={{ xs: 6 }}>
                                <StatTile
                                  label="Override token"
                                  value={
                                    overrideToken ? (result.OverrideValid ? "Valid" : "Invalid") : "—"
                                  }
                                  accent={
                                    overrideToken
                                      ? result.OverrideValid
                                        ? omzigSemantic.success
                                        : omzigSemantic.danger
                                      : undefined
                                  }
                                />
                              </Grid>
                            </Grid>

                            {showAiraNeverDiscountedCopy && (
                              <Alert severity="error">AIRA is never discounted.</Alert>
                            )}

                            {Array.isArray(result.Violations) && result.Violations.length > 0 && (
                              <Stack spacing={1}>
                                {result.Violations.map((violation, index) => (
                                  <Alert key={index} severity="error" variant="outlined">
                                    {violation}
                                  </Alert>
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            )}
          </Stack>
        </Container>
      </Box>
    </>
  );
};

Page.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;

export default Page;
