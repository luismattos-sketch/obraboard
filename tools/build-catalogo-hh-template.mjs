import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/catalogo-hh-csv";
const workbook = Workbook.create();

const catalogo = workbook.worksheets.add("catalogo_hh_csv");
const instrucoes = workbook.worksheets.add("instrucoes");
const listas = workbook.worksheets.add("listas");

catalogo.showGridLines = false;
instrucoes.showGridLines = false;
listas.showGridLines = false;

const headers = ["disciplina", "atividade", "indice_hh", "unidade"];
const exemplos = [
  ["Mecânica", "Montagem de tubulação de 2 polegadas", 0.85, "m"],
  ["Mecânica", "Montagem de tubulação de 4 polegadas", 1.25, "m"],
  ["Mecânica", "Montagem de estrutura metálica", 0.12, "kg"],
  ["Elétrica", "Lançamento de cabo elétrico", 0.08, "m"],
  ["Elétrica", "Instalação de luminária industrial", 1.5, "un"],
  ["Civil", "Execução de forma de madeira", 0.75, "m²"],
];

const totalRows = 200;
const emptyRows = Array.from({ length: totalRows - exemplos.length - 1 }, () => [
  "",
  "",
  null,
  "",
]);

catalogo.getRange(`A1:D${totalRows}`).values = [
  headers,
  ...exemplos,
  ...emptyRows,
];

catalogo.getRange("A1:D1").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
};
catalogo.getRange("A1:D1").format.rowHeightPx = 28;
catalogo.getRange(`A2:D${totalRows}`).format = {
  fill: "#FFFFFF",
  borders: { preset: "inside", style: "thin", color: "#E2E8F0" },
};
catalogo.getRange(`A1:D${totalRows}`).format.borders = {
  preset: "outside",
  style: "thin",
  color: "#CBD5E1",
};
catalogo.getRange(`A2:B${totalRows}`).format.wrapText = true;
catalogo.getRange(`C2:C${totalRows}`).format.numberFormat = "0.0000";
catalogo.getRange(`C2:C${totalRows}`).format.horizontalAlignment = "right";
catalogo.getRange(`D2:D${totalRows}`).format.horizontalAlignment = "center";
catalogo.getRange("A:A").format.columnWidthPx = 150;
catalogo.getRange("B:B").format.columnWidthPx = 390;
catalogo.getRange("C:C").format.columnWidthPx = 110;
catalogo.getRange("D:D").format.columnWidthPx = 95;
catalogo.freezePanes.freezeRows(1);

const tabela = catalogo.tables.add(`A1:D${totalRows}`, true, "TabelaCatalogoHH");
tabela.style = "TableStyleMedium2";
tabela.showFilterButton = true;

listas.getRange("A1").values = [["Disciplinas sugeridas"]];
listas.getRange("A2:A8").values = [
  ["Civil"],
  ["Elétrica"],
  ["Instrumentação"],
  ["Mecânica"],
  ["Tubulação"],
  ["Estrutura Metálica"],
  ["Automação"],
];
listas.getRange("B1").values = [["Unidades sugeridas"]];
listas.getRange("B2:B14").values = [
  ["m"],
  ["m²"],
  ["m³"],
  ["kg"],
  ["t"],
  ["un"],
  ["pç"],
  ["suporte"],
  ["base"],
  ["equipamento"],
  ["linha"],
  ["lance"],
  ["h"],
];
listas.getRange("A1:B1").format = {
  fill: "#334155",
  font: { bold: true, color: "#FFFFFF" },
};
listas.getRange("A:B").format.columnWidthPx = 170;
listas.getRange("A1:B14").format.borders = {
  preset: "all",
  style: "thin",
  color: "#E2E8F0",
};

catalogo.getRange(`A2:A${totalRows}`).dataValidation = {
  rule: { type: "list", formula1: "listas!$A$2:$A$8" },
};
catalogo.getRange(`D2:D${totalRows}`).dataValidation = {
  rule: { type: "list", formula1: "listas!$B$2:$B$14" },
};
catalogo.getRange(`C2:C${totalRows}`).dataValidation = {
  rule: {
    type: "decimal",
    operator: "greaterThanOrEqual",
    formula1: 0,
  },
};

instrucoes.getRange("A1:D1").merge();
instrucoes.getRange("A1").values = [["Modelo CSV - catálogo de HH"]];
instrucoes.getRange("A1").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF", size: 16 },
};
instrucoes.getRange("A1").format.rowHeightPx = 34;
instrucoes.getRange("A3:D10").values = [
  ["Uso", "Preencha a aba catalogo_hh_csv e exporte somente essa aba como CSV UTF-8.", "", ""],
  ["Colunas obrigatórias", "disciplina, atividade, indice_hh, unidade", "", ""],
  ["Decimal", "Use ponto no CSV para indice_hh. Exemplo: 0.85. O Excel pode mostrar vírgula conforme sua configuração regional.", "", ""],
  ["Não preencher", "id, ativo, criado_em e atualizado_em são gerados automaticamente pelo Supabase.", "", ""],
  ["Duplicidade", "Evite repetir a mesma combinação de disciplina + atividade + unidade.", "", ""],
  ["Importação", "No Supabase: Table Editor > catalogo_hh > Import data from CSV.", "", ""],
  ["RLS", "Usuários autenticados consultam registros ativos; alterações devem ser feitas pelo painel/importação.", "", ""],
  ["Atenção", "Não adicione colunas extras na aba catalogo_hh_csv antes de exportar.", "", ""],
];
instrucoes.getRange("A3:A10").format = {
  fill: "#E0F2FE",
  font: { bold: true, color: "#0F172A" },
};
instrucoes.getRange("B3:D10").merge(true);
instrucoes.getRange("A3:D10").format = {
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#CBD5E1" },
};
instrucoes.getRange("A:A").format.columnWidthPx = 150;
instrucoes.getRange("B:D").format.columnWidthPx = 220;
instrucoes.getRange("A3:D10").format.rowHeightPx = 40;

instrucoes.getRange("A12:D12").merge();
instrucoes.getRange("A12").values = [["Exemplo de CSV esperado"]];
instrucoes.getRange("A12").format = {
  fill: "#334155",
  font: { bold: true, color: "#FFFFFF" },
};
instrucoes.getRange("A13:D16").values = [
  ["disciplina", "atividade", "indice_hh", "unidade"],
  ["Mecânica", "Montagem de tubulação de 2 polegadas", 0.85, "m"],
  ["Mecânica", "Montagem de estrutura metálica", 0.12, "kg"],
  ["Elétrica", "Lançamento de cabo elétrico", 0.08, "m"],
];
instrucoes.getRange("A13:D13").format = {
  fill: "#F1F5F9",
  font: { bold: true },
};
instrucoes.getRange("A13:D16").format.borders = {
  preset: "all",
  style: "thin",
  color: "#CBD5E1",
};
instrucoes.getRange("C14:C16").format.numberFormat = "0.00";

await fs.mkdir(outputDir, { recursive: true });

for (const sheetName of ["catalogo_hh_csv", "instrucoes"]) {
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    `${outputDir}/${sheetName}.png`,
    new Uint8Array(await preview.arrayBuffer())
  );
}

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errorScan.ndjson);

const tableCheck = await workbook.inspect({
  kind: "table",
  range: "catalogo_hh_csv!A1:D12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 4,
});
console.log(tableCheck.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/modelo_catalogo_hh_supabase.xlsx`);
