import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { Grid } from "@mui/system";
import { Layout as DashboardLayout } from "../../../layouts/index";
import { ApiGetCall, ApiPostCall } from "../../../api/ApiCall";
import { useSettings } from "../../../hooks/use-settings";
import { CippHead } from "../../../components/CippComponents/CippHead";
import { CippApiResults } from "../../../components/CippComponents/CippApiResults";
import {
  OMZIG_TIERS,
  getTier,
  OMZIG_VERTICALS,
  getVertical,
  omzigScale,
  omzigSemantic,
  OmzigPageHero,
  RadialGauge,
} from "../../../omzig";

// Outlined chips sit on the dark hero panel in both themes — force light ink.
const HERO_OUTLINED_CHIP_SX = {
  color: "rgba(255, 255, 255, 0.85)",
  borderColor: "rgba(255, 255, 255, 0.35)",
};

// AI Readiness statuses (§3 / §7.7): not-started, proposed, in-progress, delivered.
const AI_STATUS_COLOR = {
  delivered: "success",
  "in-progress": "info",
  proposed: "warning",
  "not-started": "default",
};

const AI_PRODUCTS = [
  { key: "airaStatus", label: "AIRA" },
  { key: "aidfStatus", label: "AIDF" },
  { key: "aidStatus", label: "AID" },
  { key: "maioStatus", label: "MAIO" },
];

const formatStatus = (status) =>
  status
    ? status
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Unknown";


const Page = () => {
  const currentTenant = useSettings().currentTenant;
  const tenantSelected = Boolean(currentTenant) && currentTenant !== "AllTenants";

  const tenantView = ApiGetCall({
    url: "/api/ListOmzigTenantView",
    data: { tenantFilter: currentTenant },
    queryKey: `OmzigTenantView-${currentTenant}`,
    waiting: tenantSelected,
  });

  const saveSettings = ApiPostCall({
    relatedQueryKeys: [`OmzigTenantView-${currentTenant}`],
  });

  const [tier, setTier] = useState("");
  const [vertical, setVertical] = useState("");
  const [baa, setBaa] = useState(false);

  useEffect(() => {
    if (tenantView.isSuccess && tenantView.data?.record) {
      const record = tenantView.data.record;
      setTier(record.omzigTier || "");
      setVertical(record.vertical || "");
      setBaa(Boolean(record.baa));
    }
  }, [tenantView.isSuccess, tenantView.data]);

  const handleSave = () => {
    saveSettings.mutate({
      url: "/api/ExecOmzigTenantSettings",
      data: {
        tenantFilter: currentTenant,
        omzigTier: tier || null,
        vertical: vertical || null,
        baa,
      },
    });
  };

  if (!tenantSelected) {
    return (
      <>
        <CippHead title="omzig.ai Tenant View" noTenant />
        <Box sx={{ flexGrow: 1 }}>
          <Container maxWidth="lg">
            <Card>
              <CardContent>
                <Typography variant="h6">Select a tenant</Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a tenant from the tenant selector above to view its omzig.ai single-pane
                  summary.
                </Typography>
              </CardContent>
            </Card>
          </Container>
        </Box>
      </>
    );
  }

  const record = tenantView.data?.record;
  const psa = tenantView.data?.psa;
  const rmm = tenantView.data?.rmm;
  const healthScore = tenantView.data?.healthScore;
  const tierInfo = record ? getTier(record.omzigTier) : null;
  const verticalInfo = record ? getVertical(record.vertical) : null;

  return (
    <>
      <CippHead title="omzig.ai Tenant View" />
      <Box sx={{ flexGrow: 1 }}>
        <Container maxWidth="lg">
          <Stack spacing={2}>
            {/* Header — omzig.ai overlay hero */}
            {tenantView.isLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <OmzigPageHero
                title={record?.displayName || record?.tenantId || currentTenant}
                subtitle="Single-pane omzig.ai summary — health, AI readiness, PSA and RMM at a glance."
                actions={
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={tierInfo ? tierInfo.label : "No Tier"}
                      color="primary"
                      variant={tierInfo ? "filled" : "outlined"}
                      sx={!tierInfo ? HERO_OUTLINED_CHIP_SX : undefined}
                    />
                    <Chip
                      label={verticalInfo ? verticalInfo.label : "No Vertical"}
                      variant="outlined"
                      sx={HERO_OUTLINED_CHIP_SX}
                    />
                    <Chip
                      label="BAA"
                      color="success"
                      variant={record?.baa ? "filled" : "outlined"}
                      sx={!record?.baa ? HERO_OUTLINED_CHIP_SX : undefined}
                    />
                  </Stack>
                }
              />
            )}

            <Grid container spacing={2}>
              {/* Health Score */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: "100%" }}>
                  <CardHeader title="Client Health Score" />
                  <CardContent>
                    {tenantView.isLoading ? (
                      <Skeleton variant="rounded" height={100} />
                    ) : healthScore?.Score === null || healthScore?.Score === undefined ? (
                      <Typography variant="body2" color="text.secondary">
                        No telemetry yet
                      </Typography>
                    ) : (
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2.5}
                        alignItems="center"
                      >
                        <RadialGauge
                          value={Math.max(0, Math.min(1, Number(healthScore.Score) / 100))}
                          size={128}
                          accent={
                            healthScore.Score >= 80
                              ? omzigSemantic.success
                              : healthScore.Score >= 60
                                ? omzigSemantic.warn
                                : omzigSemantic.danger
                          }
                          label="Health"
                        />
                        {Array.isArray(healthScore.Components) &&
                          healthScore.Components.length > 0 && (
                            <Stack spacing={0.5} sx={{ flexGrow: 1, minWidth: 0, width: "100%" }}>
                              {healthScore.Components.map((component) => (
                                <Stack
                                  key={component.Name}
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="caption" color="text.secondary">
                                    {component.Name}
                                  </Typography>
                                  <Typography variant="caption">{component.Value}</Typography>
                                </Stack>
                              ))}
                            </Stack>
                          )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* AI Readiness */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: "100%" }}>
                  <CardHeader title="AI Readiness" />
                  <CardContent>
                    {tenantView.isLoading ? (
                      <Skeleton variant="rounded" height={100} />
                    ) : (
                      <Stack spacing={1}>
                        {AI_PRODUCTS.map((product) => {
                          const status = record?.ai?.[product.key];
                          return (
                            <Stack
                              key={product.key}
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography variant="body2">{product.label}</Typography>
                              <Chip
                                size="small"
                                label={formatStatus(status)}
                                color={AI_STATUS_COLOR[status] || "default"}
                              />
                            </Stack>
                          );
                        })}
                        <Divider />
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Shadow AI findings
                          </Typography>
                          <Typography variant="body2">
                            {record?.ai?.shadowAiFindings ?? 0}
                          </Typography>
                        </Stack>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* PSA */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: "100%" }}>
                  <CardHeader title="PSA (Autotask)" />
                  <CardContent>
                    {tenantView.isLoading ? (
                      <Skeleton variant="rounded" height={80} />
                    ) : psa?.available ? (
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Open tickets
                          </Typography>
                          <Typography variant="body2">{psa.openTicketCount ?? 0}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Contracts
                          </Typography>
                          <Typography variant="body2">
                            {psa.contractCount ?? psa.contracts?.length ?? 0}
                          </Typography>
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                          Autotask not connected
                        </Typography>
                        {psa?.reason && (
                          <Typography variant="caption" color="text.secondary">
                            {psa.reason}
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* RMM */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: "100%" }}>
                  <CardHeader title="RMM (Datto)" />
                  <CardContent>
                    {tenantView.isLoading ? (
                      <Skeleton variant="rounded" height={80} />
                    ) : rmm?.available ? (
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Devices
                          </Typography>
                          <Typography variant="body2">{rmm.deviceCount ?? 0}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Online
                          </Typography>
                          <Typography variant="body2">{rmm.onlineCount ?? 0}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Open alerts
                          </Typography>
                          <Typography variant="body2">{rmm.openAlertCount ?? 0}</Typography>
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                          Datto RMM not connected
                        </Typography>
                        {rmm?.reason && (
                          <Typography variant="caption" color="text.secondary">
                            {rmm.reason}
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Settings */}
            <Card>
              <CardHeader title="Tenant Settings" />
              <CardContent>
                {tenantView.isLoading ? (
                  <Skeleton variant="rounded" height={140} />
                ) : (
                  <Stack spacing={2}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Select
                          fullWidth
                          size="small"
                          displayEmpty
                          value={tier}
                          onChange={(e) => setTier(e.target.value)}
                        >
                          <MenuItem value="">None</MenuItem>
                          {OMZIG_TIERS.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Select
                          fullWidth
                          size="small"
                          displayEmpty
                          value={vertical}
                          onChange={(e) => setVertical(e.target.value)}
                        >
                          <MenuItem value="">None</MenuItem>
                          {OMZIG_VERTICALS.map((v) => (
                            <MenuItem key={v.id} value={v.id}>
                              {v.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={baa}
                              onChange={(e) => setBaa(e.target.checked)}
                            />
                          }
                          label="BAA"
                        />
                      </Grid>
                    </Grid>
                    <Box>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSave}
                        disabled={saveSettings.isPending}
                      >
                        {saveSettings.isPending ? "Saving..." : "Save"}
                      </Button>
                    </Box>
                    <CippApiResults apiObject={saveSettings} />
                  </Stack>
                )}
              </CardContent>
            </Card>

            {tenantView.isError && (
              <Alert severity="error">
                Unable to load the omzig.ai tenant view for this tenant.
              </Alert>
            )}
          </Stack>
        </Container>
      </Box>
    </>
  );
};

Page.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;

export default Page;
