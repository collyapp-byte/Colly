import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * The agent certificate as a PDF. Built with @react-pdf/renderer primitives so
 * it renders on the server in the download route.
 *
 * The Colly mark is drawn as styled text rather than an image: the project only
 * ships `logo.svg`, and @react-pdf/renderer cannot embed SVG without an extra
 * font/SVG package. The QR code is a PNG data URL, which react-pdf supports.
 */

export type AgentCertificatePdfProps = {
  fullName: string;
  agentNumber: string;
  certificateId: string;
  issuedAt: string;
  verifyUrl: string;
  qrDataUrl: string;
};

const ORANGE = "#FF6600";
const INK = "#111827";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    // The 8mm page padding is what insets the border from the paper edge.
    padding: "8mm",
  },
  frame: {
    flexGrow: 1,
    borderWidth: 3,
    borderColor: ORANGE,
    padding: "10mm",
    alignItems: "center",
  },
  logo: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    letterSpacing: 2,
  },
  logoSub: {
    fontSize: 8,
    color: MUTED,
    letterSpacing: 3,
    marginTop: 3,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    marginTop: 24,
    letterSpacing: 1,
  },
  certifies: {
    fontSize: 11,
    color: MUTED,
    marginTop: 22,
  },
  name: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginTop: 20,
    textAlign: "center",
  },
  nameRule: {
    width: "70%",
    height: 1,
    backgroundColor: INK,
    marginTop: 8,
  },
  body: {
    fontSize: 11,
    color: MUTED,
    marginTop: 18,
    textAlign: "center",
    lineHeight: 1.6,
  },
  programme: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginTop: 6,
    textAlign: "center",
  },
  qrBlock: {
    alignItems: "center",
    marginTop: 22,
  },
  qr: {
    width: "35mm",
    height: "35mm",
  },
  qrCaption: {
    fontSize: 7,
    color: MUTED,
    marginTop: 5,
  },
  ids: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "70%",
    marginTop: 18,
  },
  idItem: {
    fontSize: 9,
    color: MUTED,
  },
  signature: {
    alignItems: "center",
    marginTop: 26,
  },
  signatureLine: {
    width: "55mm",
    height: 1,
    backgroundColor: INK,
  },
  signatureName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginTop: 5,
  },
  signatureRole: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
});

export function AgentCertificatePdf({
  fullName,
  agentNumber,
  certificateId,
  issuedAt,
  verifyUrl,
  qrDataUrl,
}: AgentCertificatePdfProps) {
  return (
    <Document
      title={`Colly Agent Certificate - ${fullName}`}
      author="Colly"
      subject="Colly Agent Certification"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          {/* Logo — styled text; react-pdf can't embed the project's SVG mark. */}
          <Text style={styles.logo}>COLLY</Text>
          <Text style={styles.logoSub}>AGENT CERTIFICATION</Text>

          <Text style={styles.heading}>CERTIFICATE OF COMPLETION</Text>
          <Text style={styles.certifies}>This certifies that</Text>

          <Text style={styles.name}>{fullName}</Text>
          <View style={styles.nameRule} />

          <Text style={styles.body}>has successfully completed the</Text>
          <Text style={styles.programme}>
            Colly Agent Certification Programme
          </Text>
          <Text style={styles.body}>certified by Colly</Text>
          <Text style={styles.body}>on {issuedAt}, in Nigeria</Text>

          <View style={styles.qrBlock}>
            {/* react-pdf's Image has no `alt` prop; the QR is decorative here
                because the verification URL is printed directly beneath it. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.qr} src={qrDataUrl} />
            <Text style={styles.qrCaption}>{verifyUrl}</Text>
          </View>

          <View style={styles.ids}>
            <Text style={styles.idItem}>Agent ID: {agentNumber}</Text>
            <Text style={styles.idItem}>Certificate ID: {certificateId}</Text>
          </View>

          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>Ifeanyi Bryan</Text>
            <Text style={styles.signatureRole}>Chief Executive Officer</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
