import {
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Handshake,
  Search,
  Users,
} from "lucide-react-native";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { LineChart } from "../components/LineChart";
import { palette } from "../theme";
import type { ClubAccount } from "../types";

type Props = { club: ClubAccount; onSignOut: () => void };

const metrics = [
  {
    label: "Active members",
    value: "—",
    detail: "Connect membership summary",
    color: palette.purple,
    icon: Users,
  },
  {
    label: "Membership revenue",
    value: "—",
    detail: "No reporting data yet",
    color: palette.blue,
    icon: CircleDollarSign,
  },
  {
    label: "Active sponsors",
    value: "—",
    detail: "Connect sponsor summary",
    color: palette.green,
    icon: Handshake,
  },
  {
    label: "Upcoming activities",
    value: "—",
    detail: "Connect club schedule",
    color: palette.orange,
    icon: CalendarDays,
  },
];

export function OverviewScreen({ club, onSignOut }: Props) {
  return (
    <View style={styles.page}>
      <View style={styles.top}>
        <View>
          <Text style={styles.welcome}>Welcome back 👋</Text>
          <Text style={styles.sub}>
            Here’s your club overview for this season.
          </Text>
        </View>
        <View style={styles.search}>
          <Search size={16} color={palette.muted} />
          <Text style={styles.searchText}>
            Search club tools, members, matches...
          </Text>
          <Text style={styles.shortcut}>⌘K</Text>
        </View>
        <Pressable style={styles.bell}>
          <Bell size={19} color={palette.ink} />
          <View style={styles.badge} />
        </Pressable>
        <Pressable onPress={onSignOut} style={styles.avatar}>
          <Text>PF</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroRow}>
          <View style={styles.hero}>
            <View style={styles.clubVisual}>
              {club.logoUrl ? (
                <Image source={{ uri: club.logoUrl }} style={styles.heroLogo} resizeMode="contain" />
              ) : (
                <Text style={styles.heroInitial}>
                  {club.clubName.slice(0, 1)}
                </Text>
              )}
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroLabel}>PLAYFOOTY CLUB</Text>
              <Text style={styles.clubName}>{club.clubName}</Text>
              <Text style={styles.clubMeta}>Club operations dashboard</Text>
              <View style={styles.heroStats}>
                <Info label="SEASON" value="Current" />
                <Info label="ROLE" value={club.role.replaceAll("_", " ")} />
                <Info label="STATUS" value="Active" />
              </View>
            </View>
          </View>
          <View style={styles.summary}>
            <View style={styles.summaryHead}>
              <Text style={styles.panelTitle}>Club summary</Text>
              <View style={styles.season}>
                <Text>Current season⌄</Text>
              </View>
            </View>
            <View style={styles.summaryBody}>
              <View style={styles.ring}>
                <Svg width={112} height={112}>
                  <Circle
                    cx={56}
                    cy={56}
                    r={45}
                    stroke="#E9EDF3"
                    strokeWidth={10}
                    fill="none"
                  />
                  <Circle
                    cx={56}
                    cy={56}
                    r={45}
                    stroke={palette.blue}
                    strokeWidth={10}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="180 283"
                    rotation="-90"
                    origin="56,56"
                  />
                </Svg>
                <View style={styles.ringText}>
                  <Text style={styles.ringValue}>LIVE</Text>
                  <Text style={styles.ringLabel}>CLUB</Text>
                </View>
              </View>
              <View style={styles.summaryList}>
                <SummaryLine label="Account" value="Connected" />
                <SummaryLine label="Club access" value="Verified" />
                <SummaryLine label="Dashboard" value="Stage 1" />
              </View>
            </View>
            <Pressable style={styles.detailsButton}>
              <Text>View club analytics</Text>
              <ChevronRight size={17} />
            </Pressable>
          </View>
        </View>
        <View style={styles.metrics}>
          {metrics.map(({ label, value, detail, color, icon: Icon }) => (
            <View key={label} style={styles.metric}>
              <View
                style={[styles.metricIcon, { backgroundColor: `${color}16` }]}
              >
                <Icon size={18} color={color} />
              </View>
              <Text style={styles.metricLabel}>{label}</Text>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.metricDetail}>{detail}</Text>
              <LineChart compact color={color} />
            </View>
          ))}
        </View>
        <View style={styles.lower}>
          <View style={styles.trend}>
            <View style={styles.panelHead}>
              <View>
                <Text style={styles.panelTitle}>Club performance trend</Text>
                <Text style={styles.panelSub}>
                  Live reporting will appear as modules are connected.
                </Text>
              </View>
              <View style={styles.season}>
                <Text>Last 12 months⌄</Text>
              </View>
            </View>
            <View style={styles.chartWrap}>
              <LineChart color={palette.blue} />
              <View style={styles.chartLabels}>
                <Text>SEP</Text>
                <Text>NOV</Text>
                <Text>JAN</Text>
                <Text>MAR</Text>
                <Text>MAY</Text>
                <Text>JUL</Text>
                <Text>AUG</Text>
              </View>
            </View>
          </View>
          <View style={styles.sideColumn}>
            <Panel title="Next match">
              <Text style={styles.emptyTitle}>Fixture connection next</Text>
              <Text style={styles.emptyCopy}>
                Your canonical upcoming fixture will appear here.
              </Text>
            </Panel>
            <Panel title="Club activity">
              <Text style={styles.emptyTitle}>No recent activity</Text>
              <Text style={styles.emptyCopy}>
                Real club events will populate this feed.
              </Text>
            </Panel>
          </View>
        </View>
        <View style={styles.bottom}>
          <Panel title="Weekly coaching flow">
            <Progress label="Training plan" />
            <Progress label="Availability" />
            <Progress label="Team selection" />
          </Panel>
          <Panel title="Membership breakdown">
            <View style={styles.donutRow}>
              <View style={styles.miniDonut}>
                <CreditCard color={palette.blue} />
              </View>
              <View>
                <Text style={styles.emptyTitle}>Membership data</Text>
                <Text style={styles.emptyCopy}>
                  Connected in the Memberships stage.
                </Text>
              </View>
            </View>
          </Panel>
          <Panel title="Sponsor summary">
            <View style={styles.donutRow}>
              <View style={styles.miniDonut}>
                <Handshake color={palette.green} />
              </View>
              <View>
                <Text style={styles.emptyTitle}>Sponsor data</Text>
                <Text style={styles.emptyCopy}>
                  Connected in the Sponsors stage.
                </Text>
              </View>
            </View>
          </Panel>
        </View>
      </ScrollView>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}
function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}
function Progress({ label }: { label: string }) {
  return (
    <View style={styles.progress}>
      <View style={styles.progressDot} />
      <Text>{label}</Text>
      <Text style={styles.progressStatus}>Not connected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.surface },
  top: {
    height: 78,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  welcome: { fontSize: 20, fontWeight: "900", color: palette.ink },
  sub: { fontSize: 11, color: palette.muted, marginTop: 3 },
  search: {
    marginLeft: "auto",
    width: 330,
    height: 40,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchText: { fontSize: 11, color: palette.muted, flex: 1 },
  shortcut: {
    fontSize: 10,
    color: palette.muted,
    backgroundColor: palette.canvas,
    padding: 5,
    borderRadius: 5,
  },
  bell: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 7,
    top: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.red,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 18, gap: 14 },
  heroRow: { flexDirection: "row", gap: 14 },
  hero: {
    flex: 1,
    minHeight: 220,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "#FCFDFF",
  },
  clubVisual: {
    width: "40%",
    backgroundColor: palette.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLogo: { width: "78%", height: "78%" },
  heroInitial: { fontSize: 110, fontWeight: "900", color: palette.blue },
  heroCopy: { flex: 1, justifyContent: "center", padding: 22 },
  heroLabel: {
    fontSize: 9,
    color: palette.blue,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  clubName: {
    fontSize: 30,
    fontWeight: "900",
    color: palette.ink,
    lineHeight: 34,
    marginTop: 5,
  },
  clubMeta: { fontSize: 12, color: palette.muted, marginTop: 5 },
  heroStats: { flexDirection: "row", gap: 28, marginTop: 25 },
  infoLabel: {
    fontSize: 8,
    color: palette.muted,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 12,
    color: palette.ink,
    fontWeight: "800",
    textTransform: "capitalize",
    marginTop: 3,
    maxWidth: 110,
  },
  summary: {
    width: 320,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 17,
  },
  summaryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: { fontSize: 13, fontWeight: "800", color: palette.ink },
  panelSub: { fontSize: 10, color: palette.muted, marginTop: 3 },
  season: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  summaryBody: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  ring: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: { position: "absolute", alignItems: "center" },
  ringValue: { fontSize: 20, fontWeight: "900", color: palette.blue },
  ringLabel: { fontSize: 8, fontWeight: "900", color: palette.ink },
  summaryList: { flex: 1, gap: 10 },
  summaryLine: { flexDirection: "row", justifyContent: "space-between" },
  detailsButton: {
    height: 36,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  metrics: { flexDirection: "row", gap: 12 },
  metric: {
    flex: 1,
    height: 145,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 13,
    padding: 13,
    overflow: "hidden",
  },
  metricIcon: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: { fontSize: 10, fontWeight: "700", color: palette.ink },
  metricValue: {
    fontSize: 26,
    fontWeight: "900",
    color: palette.ink,
    marginTop: 4,
  },
  metricDetail: { fontSize: 9, color: palette.muted, marginTop: 1 },
  lower: { flexDirection: "row", gap: 14 },
  trend: {
    flex: 1,
    height: 250,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 16,
  },
  panelHead: { flexDirection: "row", justifyContent: "space-between" },
  chartWrap: { flex: 1, marginTop: 14 },
  chartLabels: { flexDirection: "row", justifyContent: "space-between" },
  sideColumn: { width: 320, gap: 14 },
  panel: {
    flex: 1,
    minHeight: 112,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 16,
  },
  panelBody: { marginTop: 14 },
  emptyTitle: { fontSize: 12, fontWeight: "800", color: palette.ink },
  emptyCopy: {
    fontSize: 10,
    lineHeight: 15,
    color: palette.muted,
    marginTop: 4,
  },
  bottom: { flexDirection: "row", gap: 14, minHeight: 165 },
  bottomPanel: { flex: 1 },
  progress: {
    height: 31,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.blue,
  },
  progressStatus: { marginLeft: "auto", fontSize: 9, color: palette.muted },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  miniDonut: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
