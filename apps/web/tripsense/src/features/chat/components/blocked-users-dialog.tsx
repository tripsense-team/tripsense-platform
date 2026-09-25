"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { chatApi } from "../services/chat-api";

type BlockedUser = {userId:string;displayName:string;avatarUrl:string|null};
export function BlockedUsersDialog({open,onOpenChange,onChanged}:
  {open:boolean;onOpenChange:(open:boolean)=>void;onChanged:()=>void}) {
  const {t}=useTranslation();
  const [users,setUsers]=React.useState<BlockedUser[]>([]);
  const [error,setError]=React.useState(false);
  const [busy,setBusy]=React.useState<string|null>(null);
  React.useEffect(()=>{
    if(!open)return;
    let canceled=false;setError(false);
    void chatApi.blocks().then((page)=>{if(!canceled)setUsers(page.items);})
      .catch(()=>{if(!canceled)setError(true);});
    return ()=>{canceled=true;};
  },[open]);
  const unblock=async(id:string)=>{
    setBusy(id);setError(false);
    try{await chatApi.unblock(id);setUsers((old)=>old.filter((u)=>u.userId!==id));onChanged();}
    catch{setError(true);}finally{setBusy(null);}
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{t("chat.blocks.title")}</DialogTitle>
        <DialogDescription>{t("chat.blocks.description")}</DialogDescription></DialogHeader>
      {error&&<p role="alert" className="text-sm text-destructive">{t("chat.errors.actionFailed")}</p>}
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {users.length===0?<p className="text-sm text-muted-foreground">{t("chat.blocks.empty")}</p>:
          users.map((user)=><div key={user.userId} className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span className="truncate text-sm font-medium">{user.displayName}</span>
            <Button variant="outline" size="sm" disabled={busy===user.userId} onClick={()=>void unblock(user.userId)}>
              {t("chat.blocks.unblock")}</Button>
          </div>)}
      </div>
    </DialogContent>
  </Dialog>;
}
