import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/features/collections/data/collections_repository_impl.dart';
import 'package:trip/features/collections/presentation/collections_controller.dart';

import '../../support/fake_collections_repository.dart';
import '../../support/fake_places_repository.dart';

ProviderContainer _container(
  FakeCollectionsRepository repo, {
  String? userId = 'u1',
}) {
  final c = ProviderContainer(
    overrides: [
      collectionsRepositoryProvider.overrideWithValue(repo),
      signedInUserIdProvider.overrideWithValue(userId),
    ],
  );
  addTearDown(c.dispose);
  return c;
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

void main() {
  group('saved status', () {
    test('batches many requests into one call and skips known refs', () async {
      final repo = FakeCollectionsRepository()..membership['a'] = ['c1'];
      final c = _container(repo);
      c.listen(savedStatusProvider, (_, _) {});
      final n = c.read(savedStatusProvider.notifier);

      n.request(['a']);
      n.request(['b', 'a']);
      await _settle();
      await _settle();

      expect(repo.statusCalls.length, 1);
      expect(repo.statusCalls.single.toSet(), {'a', 'b'});
      expect(n.isSaved('a'), isTrue);
      expect(n.isSaved('b'), isFalse);

      n.request(['a', 'b']);
      await _settle();
      expect(repo.statusCalls.length, 1, reason: 'already known');
    });

    test('does nothing when signed out', () async {
      final repo = FakeCollectionsRepository();
      final c = _container(repo, userId: null);
      c.listen(savedStatusProvider, (_, _) {});
      c.read(savedStatusProvider.notifier).request(['a']);
      await _settle();
      expect(repo.statusCalls, isEmpty);
    });

    test('a failed lookup stays unknown and retries next time', () async {
      final repo = FakeCollectionsRepository()..error = serverFailure;
      final c = _container(repo);
      c.listen(savedStatusProvider, (_, _) {});
      final n = c.read(savedStatusProvider.notifier);
      n.request(['a']);
      await _settle();
      await _settle();
      expect(c.read(savedStatusProvider), isEmpty);

      repo.error = null;
      n.request(['a']);
      await _settle();
      await _settle();
      expect(repo.statusCalls.length, 2);
    });

    test('update adds and removes only the difference', () async {
      final repo = FakeCollectionsRepository()..membership['a'] = ['c1', 'c2'];
      final c = _container(repo);
      c.listen(savedStatusProvider, (_, _) {});
      final n = c.read(savedStatusProvider.notifier);
      n.request(['a']);
      await _settle();
      await _settle();

      await n.update('a', {'c2', 'c3'});
      await _settle();
      await _settle();

      expect(repo.added, [('c3', 'a')]);
      expect(repo.removed, [('c1', 'a')]);
      expect(n.isSaved('a'), isTrue);
    });

    test('update rethrows failures', () async {
      final repo = FakeCollectionsRepository()..addError = serverFailure;
      final c = _container(repo);
      c.listen(savedStatusProvider, (_, _) {});
      final n = c.read(savedStatusProvider.notifier);
      await expectLater(n.update('a', {'c1'}), throwsA(serverFailure));
    });
  });

  group('collections', () {
    test('loads, creates first, renames and deletes', () async {
      final repo = FakeCollectionsRepository();
      final c = _container(repo);
      c.listen(collectionsControllerProvider, (_, _) {});
      await c.read(collectionsControllerProvider.future);
      final n = c.read(collectionsControllerProvider.notifier);

      final created = await n.create('Trip ideas');
      expect(c.read(collectionsControllerProvider).value!.first.id, created.id);

      await n.rename('c1', 'Best');
      expect(
        c
            .read(collectionsControllerProvider)
            .value!
            .firstWhere((x) => x.id == 'c1')
            .name,
        'Best',
      );

      await n.delete('c2');
      expect(
        c.read(collectionsControllerProvider).value!.any((x) => x.id == 'c2'),
        isFalse,
      );
      expect(repo.deleted, ['c2']);
    });

    test('is empty (no request) when signed out', () async {
      final repo = FakeCollectionsRepository()..error = serverFailure;
      final c = _container(repo, userId: null);
      expect(await c.read(collectionsControllerProvider.future), isEmpty);
    });

    test('a load failure surfaces as an error', () async {
      final repo = FakeCollectionsRepository()..error = serverFailure;
      final c = _container(repo);
      c.listen(collectionsControllerProvider, (_, _) {});
      await expectLater(
        c.read(collectionsControllerProvider.future),
        throwsA(serverFailure),
      );
    });
  });

  group('saved places list', () {
    test('loads the first page then appends the next', () async {
      final repo = FakeCollectionsRepository()
        ..savedPages = [
          [savedItem('a'), savedItem('b')],
          [savedItem('c')],
        ];
      final c = _container(repo);
      final provider = savedPlacesProvider('c1');
      c.listen(provider, (_, _) {});
      final first = await c.read(provider.future);
      expect(first.items.length, 2);
      expect(first.hasMore, isTrue);
      expect(repo.savedCalls.single.collectionId, 'c1');

      final n = c.read(provider.notifier);
      await n.loadMore();
      await n.loadMore(); // no more pages: ignored
      final all = c.read(provider).value!;
      expect(all.items.map((i) => i.placeRef), ['a', 'b', 'c']);
      expect(all.hasMore, isFalse);
      expect(repo.savedCalls.length, 2);
    });

    test('is empty when signed out', () async {
      final c = _container(FakeCollectionsRepository(), userId: null);
      final list = await c.read(savedPlacesProvider(null).future);
      expect(list.items, isEmpty);
    });
  });
}
