import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/design/app_tokens.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/onboarding_catalog.dart';
import '../domain/onboarding_draft.dart';
import 'onboarding_controller.dart';
import 'option_labels.dart';
import 'vnd_input_formatter.dart';

OnboardingController _notifier(WidgetRef ref) =>
    ref.read(onboardingControllerProvider.notifier);

OnboardingDraft _draft(WidgetRef ref) =>
    ref.watch(onboardingControllerProvider.select((s) => s.draft));

/// Pill-shaped choice, filled black when selected (like the web chips).
class OptionChip extends StatelessWidget {
  const OptionChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.onDeleted,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback? onDeleted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return FilterChip(
      label: Text(label),
      selected: selected,
      showCheckmark: false,
      onSelected: (_) => onTap(),
      onDeleted: onDeleted,
      labelStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
        color: selected ? colors.primaryForeground : colors.foreground,
      ),
      deleteIconColor: selected ? colors.primaryForeground : colors.foreground,
      selectedColor: colors.primary,
      backgroundColor: colors.background,
      side: BorderSide(color: selected ? colors.primary : colors.border),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
    );
  }
}

/// Full-width pill row with a round check on the right (web option list).
class OptionRow extends StatelessWidget {
  const OptionRow({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.onRemove,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// Shown for user-added choices.
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final foreground = selected ? colors.primaryForeground : colors.foreground;
    const shape = StadiumBorder();

    return Material(
      color: selected ? colors.primary : colors.background,
      shape: shape.copyWith(
        side: BorderSide(color: selected ? colors.primary : colors.border),
      ),
      child: InkWell(
        customBorder: shape,
        onTap: onTap,
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: foreground,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (onRemove != null)
                InkResponse(
                  onTap: onRemove,
                  radius: 18,
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Icon(Icons.close, size: 18, color: foreground),
                  ),
                ),
              const SizedBox(width: AppSpacing.sm),
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? colors.background : Colors.transparent,
                  border: selected ? null : Border.all(color: colors.border),
                ),
                child: selected
                    ? Icon(Icons.check, size: 16, color: colors.foreground)
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

OutlineInputBorder _boxBorder(Color color, [double width = 1]) =>
    OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadius.xxl),
      borderSide: BorderSide(color: color, width: width),
    );

/// Search box shared by the city and destination steps.
class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.hint,
    required this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    onChanged: onChanged,
    textInputAction: TextInputAction.search,
    decoration: InputDecoration(
      hintText: hint,
      prefixIcon: const Icon(Icons.search),
    ),
  );
}

bool _matches(Destination destination, String query) =>
    foldVietnamese(destination.name).contains(foldVietnamese(query.trim()));

// ---- 0. name ----------------------------------------------------------------

class NameStep extends ConsumerStatefulWidget {
  const NameStep({super.key});

  @override
  ConsumerState<NameStep> createState() => _NameStepState();
}

class _NameStepState extends ConsumerState<NameStep> {
  late final _controller = TextEditingController(
    text: ref.read(onboardingControllerProvider).draft.name,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
    key: const Key('onboarding-name'),
    controller: _controller,
    autofocus: true,
    textCapitalization: TextCapitalization.words,
    textInputAction: TextInputAction.done,
    maxLength: 60,
    onChanged: _notifier(ref).setName,
    decoration: InputDecoration(
      hintText: AppLocalizations.of(context).onbNameHint,
      counterText: '',
    ),
  );
}

// ---- 1. home city -----------------------------------------------------------

class HomeCityStep extends ConsumerStatefulWidget {
  const HomeCityStep({super.key});

  @override
  ConsumerState<HomeCityStep> createState() => _HomeCityStepState();
}

class _HomeCityStepState extends ConsumerState<HomeCityStep> {
  final _search = TextEditingController();
  var _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final city = _draft(ref).homeCity;
    final shown = [
      for (final item in popularHomeCities)
        if (_query.isEmpty || _matches(item, _query)) item,
    ];
    final typed = _query.trim();
    final canAdd =
        typed.isNotEmpty &&
        !popularHomeCities.any(
          (c) => foldVietnamese(c.name) == foldVietnamese(typed),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SearchField(
          controller: _search,
          hint: l10n.onbHomeHint,
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: AppSpacing.lg),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            if (city.isNotEmpty &&
                !popularHomeCities.any((c) => c.name == city))
              OptionChip(
                label: city,
                selected: true,
                onTap: () => _notifier(ref).setHomeCity(city),
              ),
            for (final item in shown)
              OptionChip(
                label: '${item.flag} ${item.name}'.trim(),
                selected: city == item.name,
                onTap: () => _notifier(ref).setHomeCity(item.name),
              ),
            if (canAdd)
              ActionChip(
                avatar: const Icon(Icons.add, size: 18),
                label: Text(l10n.onbPlacesAdd(typed)),
                onPressed: () {
                  _notifier(ref).setHomeCity(typed);
                  _search.clear();
                  setState(() => _query = '');
                },
              ),
          ],
        ),
      ],
    );
  }
}

// ---- 2/3. destinations --------------------------------------------------------

class PlacesStep extends ConsumerStatefulWidget {
  const PlacesStep({super.key, required this.step});

  final OnboardingStep step;

  @override
  ConsumerState<PlacesStep> createState() => _PlacesStepState();
}

class _PlacesStepState extends ConsumerState<PlacesStep> {
  final _search = TextEditingController();
  var _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final draft = _draft(ref);
    final selected = widget.step == OnboardingStep.visited
        ? draft.visited
        : draft.wantToVisit;
    final limitReached = ref.watch(
      onboardingControllerProvider.select(
        (s) => s.issue == OnboardingIssue.placesLimit,
      ),
    );
    final byRef = {for (final d in popularDestinations) d.ref: d};
    final typed = _query.trim();
    final canAdd =
        typed.isNotEmpty &&
        !byRef.containsKey(toPlaceRef(typed)) &&
        toPlaceRef(typed).isNotEmpty;

    final catalog = [
      for (final d in popularDestinations)
        if (_query.isEmpty || _matches(d, _query)) d,
    ];
    final custom = [
      for (final placeRef in selected)
        if (!byRef.containsKey(placeRef)) placeRef,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SearchField(
          controller: _search,
          hint: l10n.onbPlacesHint,
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          l10n.onbPlacesSelected(selected.length),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: context.colors.mutedForeground,
          ),
        ),
        if (limitReached)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(
              l10n.onbPlacesMax,
              style: TextStyle(color: context.colors.destructive),
            ),
          ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final placeRef in custom)
              OptionChip(
                label: draft.customLabels[placeRef] ?? placeRef,
                selected: true,
                onTap: () => _notifier(ref).togglePlace(placeRef),
              ),
            for (final d in catalog)
              OptionChip(
                label: '${d.flag} ${d.name}'.trim(),
                selected: selected.contains(d.ref),
                onTap: () => _notifier(ref).togglePlace(d.ref),
              ),
            if (canAdd)
              ActionChip(
                avatar: const Icon(Icons.add, size: 18),
                label: Text(l10n.onbPlacesAdd(typed)),
                onPressed: () {
                  _notifier(ref).addCustomPlace(typed);
                  _search.clear();
                  setState(() => _query = '');
                },
              ),
          ],
        ),
      ],
    );
  }
}

// ---- 4/6/7/8. single/multi preference ---------------------------------------

class PreferenceStepView extends ConsumerStatefulWidget {
  const PreferenceStepView({super.key, required this.preference});

  final PreferenceStep preference;

  @override
  ConsumerState<PreferenceStepView> createState() => _PreferenceStepViewState();
}

class _PreferenceStepViewState extends ConsumerState<PreferenceStepView> {
  final _custom = TextEditingController();

  @override
  void dispose() {
    _custom.dispose();
    super.dispose();
  }

  void _addCustom() {
    final text = _custom.text.trim();
    if (text.isEmpty) return;
    _notifier(ref).addCustomOption(widget.preference.dimension, text);
    _custom.clear();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final preference = widget.preference;
    final draft = _draft(ref);
    final chosen = draft.answers(preference.dimension);
    final customCodes = [
      for (final code in chosen)
        if (!preference.options.contains(code)) code,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final code in preference.options)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: OptionRow(
              key: Key('option-$code'),
              label: optionLabel(l10n, code),
              selected: chosen.contains(code),
              onTap: () => _notifier(ref).toggleOption(
                preference.dimension,
                code,
                single: preference.single,
              ),
            ),
          ),
        for (final code in customCodes)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: OptionRow(
              label: optionLabel(l10n, code, customLabels: draft.customLabels),
              selected: true,
              onTap: () =>
                  _notifier(ref).toggleOption(preference.dimension, code),
              onRemove: () =>
                  _notifier(ref).removeCustomOption(preference.dimension, code),
            ),
          ),
        if (!preference.single) ...[
          const SizedBox(height: AppSpacing.xl),
          Text(
            l10n.onbCustomAddOther,
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _custom,
                  maxLength: 40,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _addCustom(),
                  decoration: InputDecoration(
                    hintText: l10n.onbCustomHint,
                    counterText: '',
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              FilledButton(
                onPressed: _addCustom,
                style: FilledButton.styleFrom(minimumSize: const Size(88, 56)),
                child: Text(l10n.onbCustomAdd),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

// ---- 5. budget (daily amount + tier) ------------------------------------------

class BudgetStep extends ConsumerStatefulWidget {
  const BudgetStep({super.key});

  @override
  ConsumerState<BudgetStep> createState() => _BudgetStepState();
}

class _BudgetStepState extends ConsumerState<BudgetStep> {
  late final _controller = TextEditingController(
    text: formatVnd(ref.read(onboardingControllerProvider).draft.dailyBudget),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final draft = _draft(ref);
    final showError =
        draft.dailyBudget.isNotEmpty && !draft.hasValidDailyBudget;
    final tiers = preferenceFor(OnboardingStep.budget)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          key: const Key('onboarding-budget'),
          controller: _controller,
          keyboardType: TextInputType.number,
          inputFormatters: const [VndInputFormatter()],
          onChanged: (text) => _notifier(ref).setDailyBudget(digitsOf(text)),
          decoration: InputDecoration(
            labelText: l10n.onbBudgetLabel,
            hintText: l10n.onbBudgetHint,
            suffixText: 'VNĐ',
            errorText: showError ? l10n.onbBudgetInvalid : null,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        PreferenceStepView(preference: tiers),
      ],
    );
  }
}

// ---- 9. free text -------------------------------------------------------------

class NoteStep extends ConsumerStatefulWidget {
  const NoteStep({super.key});

  @override
  ConsumerState<NoteStep> createState() => _NoteStepState();
}

class _NoteStepState extends ConsumerState<NoteStep> {
  late final _controller = TextEditingController(
    text: ref.read(onboardingControllerProvider).draft.freeText,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = _draft(ref).freeText;
    // Quick tags edit the draft; mirror that into the field.
    if (_controller.text != text) {
      _controller.value = TextEditingValue(
        text: text,
        selection: TextSelection.collapsed(offset: text.length),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          key: const Key('onboarding-note'),
          controller: _controller,
          minLines: 5,
          maxLines: 8,
          maxLength: maxFreeTextLength,
          inputFormatters: [
            LengthLimitingTextInputFormatter(maxFreeTextLength),
          ],
          onChanged: _notifier(ref).setFreeText,
          decoration: InputDecoration(
            hintText: l10n.onbNoteHint,
            counterText: '',
            border: _boxBorder(context.colors.input),
            enabledBorder: _boxBorder(context.colors.input),
            focusedBorder: _boxBorder(context.colors.foreground, 1.5),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(
              l10n.onbNoteCount(text.length, maxFreeTextLength),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: context.colors.mutedForeground,
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final tag in QuickTag.values)
              ActionChip(
                label: Text(quickTagLabel(l10n, tag)),
                onPressed: () =>
                    _notifier(ref).addQuickTag(quickTagLabel(l10n, tag)),
              ),
          ],
        ),
      ],
    );
  }
}
