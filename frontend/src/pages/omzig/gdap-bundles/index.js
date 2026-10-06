import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Grid } from "@mui/system";
import {
  ExpandMore,
  LocalHospitalOutlined,
  GavelOutlined,
  TrendingUpOutlined,
  ApartmentOutlined,
  HotelOutlined,
  FamilyRestroomOutlined,
  ShieldOutlined,
} from "@mui/icons-material";
import { Layout as DashboardLayout } from "../../../layouts/index";
import { ApiGetCallWithPagination, ApiPostCall } from "../../../api/ApiCall";
import { CippHead } from "../../../components/CippComponents/CippHead";
import { CippApiResults } from "../../../components/CippComponents/CippApiResults";
import {
  OMZIG_GDAP_BUNDLES,
  getVertical,
  omzigScale,
  OmzigPageHero,
  ProgressRing,
  TiltCard,
  OmzigReveal,
} from "../../../omzig";

const apiUrl = "/api/ExecGDAPRoleTemplate";
const queryKey = "ListGDAPRoleTemplates";

// Per-vertical identity: icon + gradient so each bundle card reads at a glance.
const VERTICAL_STYLES = {
  healthcare: { icon: <LocalHospitalOutlined />, from: "#14B8A6", to: "#0E7490" },
  legal: { icon: <GavelOutlined />, from: "#818CF8", to: "#4F46E5" },
  wealth: { icon: <TrendingUpOutlined />, from: "#F59E0B", to: "#B45309" },
  title: { icon: <ApartmentOutlined />, from: "#5FC0FF", to: "#0F70CC" },
  hospitality: { icon: <HotelOutlined />, from: "#FB7185", to: "#BE123C" },
  "family-office": { icon: <FamilyRestroomOutlined />, from: "#A78BFA", to: "#6D28D9" },
};

const verticalStyle = (slug) =>
  VERTICAL_STYLES[slug] || { icon: <ShieldOutlined />, from: omzigScale[400], to: omzigScale[700] };

const Page = () => {
  const templatesQuery = ApiGetCallWithPagination({
    url: apiUrl,
    queryKey,
  });

  const importTemplate = ApiPostCall({
    relatedQueryKeys: [queryKey],
  });

  // Which bundle the in-flight (or most recently completed) mutation belongs
  // to, so only that bundle's button/result reflects the mutation state —
  // the underlying mutation object is shared across every "Import" button.
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [importAllSummary, setImportAllSummary] = useState(null);
  const [importAllRunning, setImportAllRunning] = useState(false);

  const importedTemplateIds = useMemo(() => {
    const ids = new Set();
    templatesQuery.data?.pages?.forEach((page) => {
      (page?.Results || []).forEach((template) => {
        if (template?.TemplateId) {
          ids.add(template.TemplateId);
        }
      });
    });
    return ids;
  }, [templatesQuery.data]);

  const statusKnown = templatesQuery.isSuccess;
  const notYetImported = statusKnown
    ? OMZIG_GDAP_BUNDLES.filter((bundle) => !importedTemplateIds.has(bundle.TemplateId))
    : [];
  const importedCount = OMZIG_GDAP_BUNDLES.length - notYetImported.length;
  const total = OMZIG_GDAP_BUNDLES.length;

  const buildPayload = (bundle) => ({
    TemplateId: bundle.TemplateId,
    RoleMappings: bundle.RoleMappings,
  });

  const handleImport = (bundle) => {
    setImportAllSummary(null);
    setActiveTemplateId(bundle.TemplateId);
    importTemplate.mutate({
      url: `${apiUrl}?Action=Add`,
      data: buildPayload(bundle),
    });
  };

  const handleImportAll = async () => {
    if (notYetImported.length === 0 || importAllRunning) {
      return;
    }
    setImportAllSummary(null);
    setImportAllRunning(true);

    const succeeded = [];
    const failed = [];
    for (const bundle of notYetImported) {
      setActiveTemplateId(bundle.TemplateId);
      try {
        await importTemplate.mutateAsync({
          url: `${apiUrl}?Action=Add`,
          data: buildPayload(bundle),
        });
        succeeded.push(bundle.TemplateId);
      } catch (e) {
        failed.push(bundle.TemplateId);
      }
    }

    setImportAllRunning(false);
    setImportAllSummary({ succeeded, failed });
  };

  const isBusy = importTemplate.isPending || importAllRunning;

  return (
    <>
      <CippHead title="GDAP Vertical Bundles" noTenant />
      <Box sx={{ flexGrow: 1 }}>
        <Container maxWidth="lg">
          <Stack spacing={3}>
            <OmzigPageHero
              title="omzig.ai GDAP Vertical Bundle Importer"
              subtitle="Import the §6.1 / §17 item 10 vertical GDAP role bundles into the standard GDAP Role Templates library. Re-import is safe — Add merges missing roles by roleDefinitionId and never removes an existing role."
              actions={
                <Tooltip
                  title={
                    statusKnown && notYetImported.length === 0
                      ? "Every bundle is already imported"
                      : ""
                  }
                >
                  <span style={{ display: "block" }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleImportAll}
                      disabled={!statusKnown || notYetImported.length === 0 || isBusy}
                      sx={{ width: { xs: "100%", md: "auto" } }}
                    >
                      {importAllRunning
                        ? "Importing all..."
                        : `Import all (${notYetImported.length} remaining)`}
                    </Button>
                  </span>
                </Tooltip>
              }
            >
              <Stack direction="row" spacing={2.5} alignItems="center">
                {statusKnown && (
                  <ProgressRing
                    value={total ? importedCount / total : 0}
                    centerLabel={`${importedCount}/${total}`}
                    size={92}
                  />
                )}
                <Stack spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: alpha("#FFFFFF", 0.78) }}>
                    {statusKnown
                      ? `${importedCount} of ${total} vertical bundles imported into the GDAP Role Templates library`
                      : "Import status unavailable until the template list loads"}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={statusKnown ? (importedCount / total) * 100 : 0}
                    sx={{ height: 8 }}
                  />
                </Stack>
              </Stack>
            </OmzigPageHero>

            {templatesQuery.isError && (
              <Alert severity="error">
                Unable to load existing GDAP role templates. Import status below is unknown, but
                importing is still safe — Add merges by roleDefinitionId.
              </Alert>
            )}

            {importAllSummary && (
              <Alert severity={importAllSummary.failed.length > 0 ? "warning" : "success"}>
                Import all finished: {importAllSummary.succeeded.length} succeeded
                {importAllSummary.failed.length > 0
                  ? `, ${importAllSummary.failed.length} failed (${importAllSummary.failed.join(", ")})`
                  : ""}
                .
              </Alert>
            )}

            {templatesQuery.isLoading ? (
              <Grid container spacing={2}>
                {[0, 1, 2].map((i) => (
                  <Grid key={i} size={{ xs: 12, md: 6 }}>
                    <Skeleton variant="rounded" height={220} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={2.5}>
                {OMZIG_GDAP_BUNDLES.map((bundle, index) => {
                  const vertical = getVertical(bundle.Vertical);
                  const style = verticalStyle(bundle.Vertical);
                  const imported = importedTemplateIds.has(bundle.TemplateId);
                  const isThisBundleActive = activeTemplateId === bundle.TemplateId;

                  return (
                    <Grid key={bundle.TemplateId} size={{ xs: 12, md: 6 }}>
                     <OmzigReveal delay={index * 70} sx={{ height: "100%" }}>
                      <TiltCard>
                      <Card
                        sx={{
                          height: "100%",
                          position: "relative",
                          overflow: "hidden",
                          transition: "box-shadow 180ms ease, border-color 180ms ease",
                          "&:hover": {
                            borderColor: alpha(style.from, 0.5),
                            boxShadow: `0 18px 40px -18px ${alpha(style.from, 0.55)}`,
                          },
                          // Vertical identity ribbon along the top edge.
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            background: `linear-gradient(90deg, ${style.from}, ${style.to})`,
                          },
                        }}
                      >
                        <CardHeader
                          avatar={
                            <Avatar
                              variant="rounded"
                              sx={{
                                background: `linear-gradient(135deg, ${style.from}, ${style.to})`,
                                color: "#FFFFFF",
                                boxShadow: `0 6px 18px -6px ${alpha(style.from, 0.8)}`,
                              }}
                            >
                              {style.icon}
                            </Avatar>
                          }
                          title={bundle.TemplateId}
                          subheader={vertical ? vertical.label : bundle.Vertical}
                          action={
                            <Chip
                              size="small"
                              label={
                                !statusKnown ? "Status unknown" : imported ? "Imported" : "Not imported"
                              }
                              color={!statusKnown ? "default" : imported ? "success" : "warning"}
                              variant={!statusKnown ? "outlined" : "filled"}
                            />
                          }
                        />
                        <CardContent>
                          <Stack spacing={2}>
                            <Typography variant="body2" color="text.secondary">
                              {bundle.Description}
                            </Typography>

                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">
                                Role mappings
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ fontVariantNumeric: "tabular-nums" }}
                              >
                                {bundle.RoleMappings.length}
                              </Typography>
                            </Stack>

                            <Accordion variant="outlined">
                              <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="body2">
                                  View {bundle.RoleMappings.length} role mappings
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Stack spacing={1} divider={<Divider flexItem />}>
                                  {bundle.RoleMappings.map((mapping) => (
                                    <Stack
                                      key={mapping.roleDefinitionId}
                                      direction={{ xs: "column", sm: "row" }}
                                      justifyContent="space-between"
                                    >
                                      <Typography variant="body2">{mapping.RoleName}</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {mapping.GroupName}
                                      </Typography>
                                    </Stack>
                                  ))}
                                </Stack>
                              </AccordionDetails>
                            </Accordion>

                            <Divider />

                            <Box>
                              <Button
                                variant={imported ? "outlined" : "contained"}
                                onClick={() => handleImport(bundle)}
                                disabled={isBusy}
                              >
                                {isThisBundleActive && importTemplate.isPending
                                  ? "Importing..."
                                  : imported
                                    ? "Re-import (merge)"
                                    : "Import"}
                              </Button>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mt: 0.5 }}
                              >
                                {imported
                                  ? "Re-import merges any missing roles into the existing template; it never removes roles already assigned."
                                  : "Adds this bundle as a new GDAP role template."}
                              </Typography>
                            </Box>

                            {isThisBundleActive && <CippApiResults apiObject={importTemplate} />}
                          </Stack>
                        </CardContent>
                      </Card>
                      </TiltCard>
                     </OmzigReveal>
                    </Grid>
                  );
                })}
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
