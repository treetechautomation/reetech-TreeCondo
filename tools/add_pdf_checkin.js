const fs = require("fs");
const path = require("path");

const file = path.join("src", "app", "reservas", "convidados-checkin", "[reservaId]", "page.tsx");

if (!fs.existsSync(file)) {
  console.error("❌ Arquivo não encontrado:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");

// 1) Imports
if (!s.includes('from "jspdf"')) {
  // tenta inserir depois do último import
  const importBlockMatch = s.match(/^(?:import[^\n]*\n)+/m);
  if (!importBlockMatch) {
    console.error("❌ Não consegui localizar bloco de imports no topo do arquivo.");
    process.exit(1);
  }
  const imports = importBlockMatch[0];
  const extra = `import jsPDF from "jspdf";\nimport autoTable from "jspdf-autotable";\n`;
  s = s.replace(imports, imports + extra);
}

// 2) Função baixarPDF() (inserir depois da função marcarEntrou)
if (!s.includes("function baixarPDF()")) {
  const marker = "async function marcarEntrou(item: Convidado)";
  const idx = s.indexOf(marker);
  if (idx === -1) {
    console.error("❌ Não achei a função marcarEntrou().");
    process.exit(1);
  }

  // acha o fim da função marcarEntrou procurando o próximo "return ("
  const returnIdx = s.indexOf("return (", idx);
  if (returnIdx === -1) {
    console.error("❌ Não achei o return ( ) depois de marcarEntrou().");
    process.exit(1);
  }

  const pdfFn = `

    function baixarPDF() {
      const doc = new jsPDF();

      const titulo = \`Lista de Convidados - Reserva \${String(reservaId)}\`;
      doc.setFontSize(14);
      doc.text(titulo, 14, 16);

      doc.setFontSize(10);
      doc.text(\`Área: \${areaLabel}\`, 14, 24);
      doc.text(\`Status da Reserva: \${statusReserva}\`, 14, 30);

      const body = filtrados.map((c, idx) => ([
        String(idx + 1).padStart(2, "0"),
        String(c.nome || "-"),
        String(c.cpf ? maskCpf(c.cpf) : "-"),
        String(c.status || "PENDENTE"),
      ]));

      autoTable(doc, {
        startY: 36,
        head: [["Nº", "Nome", "CPF", "Status"]],
        body,
        styles: { fontSize: 9 },
        headStyles: { fontSize: 9 },
      });

      doc.save(\`convidados_\${String(reservaId)}.pdf\`);
    }
`;

  s = s.slice(0, returnIdx) + pdfFn + s.slice(returnIdx);
}

// 3) Botão "Baixar PDF" no headerActions
if (!s.includes("Baixar PDF")) {
  // tenta inserir logo depois do botão Voltar (Link href="/reservas/agenda")
  const voltarPattern = /<Button[^>]*variant="outline"[^>]*asChild>[\s\S]*?<Link href="\/reservas\/agenda">Voltar<\/Link>[\s\S]*?<\/Button>/m;
  const m = s.match(voltarPattern);
  if (!m) {
    console.error('❌ Não achei o bloco do botão "Voltar" no headerActions para inserir o botão do PDF.');
    process.exit(1);
  }

  const insertAfter = m[0];
  const pdfBtn = `

            <Button onClick={baixarPDF}>
              Baixar PDF
            </Button>`;

  s = s.replace(insertAfter, insertAfter + pdfBtn);
}

fs.writeFileSync(file, s, "utf8");
console.log("✅ PDF adicionado: imports + função baixarPDF() + botão 'Baixar PDF' no header.");
