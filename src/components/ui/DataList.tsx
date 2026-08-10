import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { type AppColors, ListLayout, useAppColors } from '@/src/styles';

interface DataListProps<T> {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactElement;

  /** 'cards' -> separador de aire (ListLayout.cardGap).
   *  'rows'  -> hairline con inset (ListLayout.separatorInset). */
  variant?: 'cards' | 'rows';

  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;

  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyTitle: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;

  header?: React.ReactNode;
  footer?: React.ReactNode;
  onEndReached?: () => void;
  loadingMore?: boolean;
  contentPadded?: boolean;
}

function DataListInner<T>({
  data,
  keyExtractor,
  renderItem,
  variant = 'cards',
  loading = false,
  loadingMessage,
  error = null,
  onRetry,
  refreshing = false,
  onRefresh,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  header,
  footer,
  onEndReached,
  loadingMore = false,
  contentPadded = true,
}: DataListProps<T>) {
  const colors = useAppColors();
  const styles = createStyles(colors, contentPadded);

  if (loading && data.length === 0) {
    return <LoadingState message={loadingMessage} />;
  }

  if (error && data.length === 0) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const Separator =
    variant === 'rows' ? () => <View style={styles.rowSeparator} /> : () => <View style={styles.cardSeparator} />;

  return (
    <FlatList
      data={data as T[]}
      keyExtractor={keyExtractor}
      renderItem={(info: ListRenderItemInfo<T>) => renderItem(info.item, info.index)}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header ? <>{header}</> : null}
      ListFooterComponent={
        footer || loadingMore ? (
          <View>
            {footer}
            {loadingMore ? (
              <ActivityIndicator style={styles.loadingMore} size="small" color={colors.primary} />
            ) : null}
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
    />
  );
}

const createStyles = (colors: AppColors, contentPadded: boolean) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: contentPadded ? ListLayout.contentPaddingHorizontal : 0,
      paddingBottom: ListLayout.contentPaddingBottom,
      flexGrow: 1,
    },
    cardSeparator: {
      height: ListLayout.cardGap,
    },
    rowSeparator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: ListLayout.separatorInset,
      backgroundColor: colors.divider,
    },
    loadingMore: {
      paddingVertical: 16,
    },
  });

export const DataList = DataListInner as <T>(props: DataListProps<T>) => React.ReactElement;
export type { DataListProps };
