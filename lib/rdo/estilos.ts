import { StyleSheet } from "@react-pdf/renderer";

export const COR = {
  primaria: "#1F3A5F",
  texto: "#1F2937",
  suave: "#6B7280",
  borda: "#D1D5DB",
  fundo: "#F3F4F6",
  marca: "#E5E7EB",
};

export const estilos = StyleSheet.create({
  pagina: { fontFamily: "Helvetica", fontSize: 9, color: COR.texto, paddingTop: 62, paddingBottom: 56, paddingHorizontal: 36 },
  cabecalhoFixo: {
    position: "absolute", top: 20, left: 36, right: 36, height: 30,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: COR.primaria, paddingBottom: 6,
  },
  logo: { height: 22, objectFit: "contain" },
  tituloFixo: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COR.primaria },
  rodape: {
    position: "absolute", bottom: 20, left: 36, right: 36,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: COR.borda, paddingTop: 6, fontSize: 8, color: COR.suave,
  },
  marcaDagua: {
    position: "absolute", top: 330, left: 20, width: 555, textAlign: "center",
    fontSize: 96, fontFamily: "Helvetica-Bold", color: COR.marca, transform: "rotate(-40deg)",
  },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: COR.primaria, marginBottom: 8 },
  secao: { fontSize: 11, fontFamily: "Helvetica-Bold", color: COR.primaria, marginTop: 14, marginBottom: 6 },
  grade: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: COR.borda },
  campo: { width: "33.33%", padding: 5 },
  rotulo: { fontSize: 7, color: COR.suave, textTransform: "uppercase", marginBottom: 1 },
  valor: { fontSize: 9.5 },
  linhaCab: { flexDirection: "row", backgroundColor: COR.primaria, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  linha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COR.borda },
  linhaZebra: { backgroundColor: COR.fundo },
  celula: { padding: 4 },
  direita: { textAlign: "right" },
  suave: { color: COR.suave },
  metricas: { flexDirection: "row", gap: 8 },
  metrica: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: COR.borda, padding: 8 },
  metricaValor: { fontSize: 18, fontFamily: "Helvetica-Bold", color: COR.primaria },
  item: { marginBottom: 4 },
  negrito: { fontFamily: "Helvetica-Bold" },
});
