import { buildPreachingReportCsv } from '../preaching-report-csv';

it('quotes names, preserves numbers and protects spreadsheet cells', () => {
  const csv = buildPreachingReportCsv([['Nombre', 'Horas'], ['Ana, "López"', 2.5], ['  =1+1', null]]);
  expect(csv).toBe('\uFEFF"Nombre","Horas"\r\n"Ana, ""López""","2.5"\r\n"\'  =1+1",""\r\n');
});
