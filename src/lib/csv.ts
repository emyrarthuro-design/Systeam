export function downloadCSV(filename: string, headers: string[], data: any[][]) {
  const processCell = (cell: any) => {
    let cellString = cell === null || cell === undefined ? '' : String(cell);
    if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
      cellString = `"${cellString.replace(/"/g, '""')}"`;
    }
    return cellString;
  };

  const csvContent = [
    headers.join(','),
    ...data.map(row => row.map(processCell).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
