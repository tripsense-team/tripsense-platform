package fu.tripsense.recommendation.adapter.out.persistence;

import fu.tripsense.recommendation.application.RequestDiagnostics;
import java.util.IdentityHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.transaction.TransactionExecution;
import org.springframework.transaction.TransactionExecutionListener;

/** Boot registers this observer on its transaction manager; transaction behavior is unchanged. */
@Component
public class ImpressionTransactionDiagnostics implements TransactionExecutionListener {
  private static final String RECORD_TRANSACTION =
      JdbcRecommendationStore.class.getName() + ".record";
  private final ThreadLocal<Map<TransactionExecution, RequestDiagnostics.Phase>> samples =
      new ThreadLocal<>();

  @Override
  public void beforeBegin(TransactionExecution transaction) {
    // Includes connection acquisition plus transaction setup, NOT pure pool wait time.
    start(transaction, "impression_transaction_begin");
  }

  @Override
  public void afterBegin(TransactionExecution transaction, Throwable failure) {
    finish(transaction, failure);
  }

  @Override
  public void beforeCommit(TransactionExecution transaction) {
    start(transaction, "impression_transaction_commit");
  }

  @Override
  public void afterCommit(TransactionExecution transaction, Throwable failure) {
    finish(transaction, failure);
  }

  @Override
  public void beforeRollback(TransactionExecution transaction) {
    start(transaction, "impression_transaction_rollback");
  }

  @Override
  public void afterRollback(TransactionExecution transaction, Throwable failure) {
    finish(transaction, failure);
  }

  private void start(TransactionExecution transaction, String phase) {
    if (RequestDiagnostics.requestId() == null
        || !RECORD_TRANSACTION.equals(transaction.getTransactionName())) return;
    Map<TransactionExecution, RequestDiagnostics.Phase> current = samples.get();
    if (current == null) {
      current = new IdentityHashMap<>();
      samples.set(current);
    }
    current.put(transaction, RequestDiagnostics.start(phase));
  }

  private void finish(TransactionExecution transaction, Throwable failure) {
    Map<TransactionExecution, RequestDiagnostics.Phase> current = samples.get();
    if (current == null) return;
    RequestDiagnostics.Phase sample = current.remove(transaction);
    if (current.isEmpty()) samples.remove();
    if (sample != null) sample.finish(failure != null);
  }
}
