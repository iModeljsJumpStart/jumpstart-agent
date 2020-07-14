import { assert, DbResult } from "@bentley/bentleyjs-core";
import { BriefcaseDb, ChangeSummaryManager, InstanceChange } from "@bentley/imodeljs-backend";
import { ChangedValueState, ChangeOpCode } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

export async function watchSlabs(ctx: AuthorizedClientRequestContext, db: BriefcaseDb) {
  // Extract summary information about the current version of the briefcase/iModel into the change cache
  const changeSummaryIds = await ChangeSummaryManager.extractChangeSummaries(ctx, db, { currentVersionOnly: true });

  // Attach a change cache file to the iModel to enable querying the change summary
  ChangeSummaryManager.attachChangeCache(db);

  // Find the change summary that was just created
  assert(changeSummaryIds.length === 1);
  const changeSummary = ChangeSummaryManager.queryChangeSummary(db, changeSummaryIds[0]);

  const ecsql = `
    SELECT
      c.ECInstanceId as changeId,
      e.userLabel
    FROM ecchange.Change.InstanceChange c
    JOIN bis.Element e ON (e.ECInstanceId = c.changedInstance.Id)
    JOIN ecchange.change.PropertyValueChange p ON (p.InstanceChange.id = c.ECInstanceId)
    WHERE c.summary.id = ?
    AND p.accessString ='IFCMaterialName'
    AND e.ECClassId IS (sp.Slab)
  `;

  db.withPreparedStatement(ecsql, (stmt) => {
    stmt.bindId(1, changeSummary.id);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const { changeId, userLabel } = stmt.getRow();
      const instanceChange = ChangeSummaryManager.queryInstanceChange(db, changeId);
      console.log(`[${ChangeOpCode[instanceChange.opCode]}] ${userLabel}`);
      getPropertyChanges(db, instanceChange);
    }
  });
}

function querySingleRow(db: BriefcaseDb, ecsql: string) {
  return db.withPreparedStatement(ecsql, (stmt) => (stmt.step() === DbResult.BE_SQLITE_ROW) ? stmt.getRow() : {});
}

function getPropertyChanges(db: BriefcaseDb, instanceChange: InstanceChange) {
  const generatedECSql = ChangeSummaryManager.buildPropertyValueChangesECSql(db, instanceChange, ChangedValueState.AfterUpdate, ["IFCMaterialName"]);
  for (const [name, value] of Object.entries(querySingleRow(db, generatedECSql))) {
    console.log(`\t${name} updated to "${value}"!`);
  }
}
