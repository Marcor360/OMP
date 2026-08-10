// Primitivas nuevas (Fase 2 - sistema de plantillas compartidas)
export * from '@/src/components/ui/Avatar';
export * from '@/src/components/ui/ListRow';
export * from '@/src/components/ui/PersonRow';
export * from '@/src/components/ui/EntityCard';
export * from '@/src/components/ui/DataList';
export * from '@/src/components/ui/SectionCard';
export * from '@/src/components/ui/SectionHeader';
export * from '@/src/components/ui/InfoRow';
export * from '@/src/components/ui/FormField';
export * from '@/src/components/ui/Chip';
export * from '@/src/components/ui/ChipGroup';

// Primitivas existentes, reexportadas aqui para que las pantallas importen
// solo desde '@/src/components/ui'. Los archivos originales no se borran.
export * from '@/src/components/common/EmptyState';
export * from '@/src/components/common/ErrorState';
export * from '@/src/components/common/LoadingState';
export * from '@/src/components/common/StatusBadge';
export * from '@/src/components/layout/PageHeader';
export * from '@/src/components/layout/ScreenContainer';
