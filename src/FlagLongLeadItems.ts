import { assert, DbResult, Id64String } from "@bentley/bentleyjs-core";
import { BriefcaseDb, ChangeSummaryManager, InstanceChange } from "@bentley/imodeljs-backend";
import { ChangedValueState, ChangeOpCode } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

export interface PropertyChanges {
  [propertyName: string]: {
    oldValue?: any;
    newValue?: any;
  };
}

export interface ChangedElementReport {
  id: Id64String;
  date: string;
  description: string;
  sections: {
    [elementUserLabel: string]: {
      [className: string]: {
        changeType: string;
        propertyChanges: PropertyChanges;
      };
    };
  };
}

export async function flagLongLeadItems(ctx: AuthorizedClientRequestContext, db: BriefcaseDb) {
  // Extract summary information about the current version of the briefcase/iModel into the change cache
  const changeSummaryIds = await ChangeSummaryManager.extractChangeSummaries(ctx, db, { currentVersionOnly: true });

  // Attach a change cache file to the iModel to enable querying the change summary
  ChangeSummaryManager.attachChangeCache(db);

  // Find the change summary that was just created
  assert(changeSummaryIds.length === 1);
  const changeSummary = ChangeSummaryManager.queryChangeSummary(db, changeSummaryIds[0]);
  const report: ChangedElementReport = {
    id: changeSummary.changeSet.wsgId,
    date: changeSummary.changeSet.pushDate,
    description: changeSummary.changeSet.description,
    sections: {},
  };

  const ecsql = `
    SELECT
      c.ECInstanceId as changeId,
      e.userLabel
    FROM ecchange.Change.InstanceChange c
    LEFT JOIN bis.ElementUniqueAspect ua ON (ua.ECInstanceId = c.changedInstance.id)
    LEFT JOIN bis.ElementMultiAspect ma ON (ma.ECInstanceId = c.changedInstance.id)
    JOIN bis.Element e ON (e.ECInstanceId IN (c.changedInstance.id, ua.Element.id, ma.Element.id))
    JOIN ifc.ifcAspect_IfcEnergyConversionDevice_PSet_Revit_Type_Identity_Data a ON (a.Element.id = e.ECInstanceId)
    JOIN change.PropertyValueChange p ON (p.InstanceChange.id = c.ECInstanceId)
    WHERE c.summary.id = ?
      AND c.changedInstance.classId IS (bis.Element, bis.ElementAspect)
      AND a.ifcOmniClass__x0020__Number ='23.75.10.24.21.21.21'
      AND p.accessString NOT IN ('LastMod', 'Checksum')
    ORDER BY e.userLabel
  `;

  db.withPreparedStatement(ecsql, (stmt) => {
    stmt.bindId(1, changeSummary.id);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const { changeId, userLabel } = stmt.getRow();

      const reportSection = report.sections[userLabel] || {};
      const instanceChange = ChangeSummaryManager.queryInstanceChange(db, changeId);
      reportSection[instanceChange.changedInstance.className] = {
        changeType: ChangeOpCode[instanceChange.opCode],
        propertyChanges: getPropertyChanges(db, instanceChange),
      };
      report.sections[userLabel] = reportSection;
    }
  });

  if (Object.keys(report.sections).length === 0)
    return undefined;

  return report;
}

function querySingleRow(db: BriefcaseDb, ecsql: string) {
  return db.withPreparedStatement(ecsql, (stmt) => (stmt.step() === DbResult.BE_SQLITE_ROW) ? stmt.getRow() : {});
}

function getPropertyChanges(db: BriefcaseDb, instanceChange: InstanceChange) {
  const propChanges: PropertyChanges = {};
  const isDelete = (instanceChange.opCode === ChangeOpCode.Delete);
  const isInsert = (instanceChange.opCode === ChangeOpCode.Insert);
  const isUpdate = (instanceChange.opCode === ChangeOpCode.Update);

  if (isDelete || isUpdate) {
    const state = (isDelete) ? ChangedValueState.BeforeDelete : ChangedValueState.BeforeUpdate;
    const generatedECSql = ChangeSummaryManager.buildPropertyValueChangesECSql(db, instanceChange, state);
    for (const [name, value] of Object.entries(querySingleRow(db, generatedECSql))) {
      propChanges[name] = {
        oldValue: value,
      };
    }
  }

  if (isInsert || isUpdate) {
    const state = (isInsert) ? ChangedValueState.AfterInsert : ChangedValueState.AfterUpdate;
    const generatedECSql = ChangeSummaryManager.buildPropertyValueChangesECSql(db, instanceChange, state);
    for (const [name, value] of Object.entries(querySingleRow(db, generatedECSql))) {
      propChanges[name] = propChanges[name] || {};
      propChanges[name].newValue = value;
    }
  }

  return propChanges;
}
