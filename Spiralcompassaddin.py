import adsk.core,adsk.fusion,traceback,tempfile,os,json,math
from pathlib import Path
app=None;ui=None;handlers=[];_pending_dxf=None;_custom_event=None
PALETTE_ID='SpiralCompassPalette';COMMAND_ID='SpiralCompassCommand'
PLANE_CMD_ID='SpiralCompassPlaneSelect';CUSTOM_EVENT_ID='SpiralCompassTriggerPlaneSelect'
PANEL_ID='SolidScriptsAddinsPanel';WORKSPACE_ID='FusionSolidEnvironment'

#def transform_dxf(dxf_text,x_off,y_off,rot_deg,scale):
#    c=math.cos(math.radians(rot_deg));s=math.sin(math.radians(rot_deg))
#    def tp(x,y):
#        xs,ys=x*scale,y*scale
#        return xs*c-ys*s+x_off,xs*s+ys*c+y_off
#    lines=dxf_text.splitlines();out=[];xb={};xp={}
#    i=0
#    while i<len(lines):
#        rc=lines[i].strip()
#        if i+1>=len(lines): out.append(lines[i]); break
#        rv=lines[i+1]
#        try: code=int(rc)
#        except: out.append(lines[i]); i+=1; continue
#        if code in(10,11):
#            xb[code]=float(rv.strip()); out.append(lines[i]); xp[code]=len(out); out.append(None); i+=2
#        elif code in(20,21):
#            xc=code-10
#            if xc in xb:
#                xt,yt=tp(xb.pop(xc),float(rv.strip()))
#                out[xp.pop(xc)]=f'{xt:.6f}'; out.append(lines[i]); out.append(f'{yt:.6f}')
#            else: out.append(lines[i]); out.append(rv)
#            i+=2
#        else: out.append(lines[i]); out.append(rv); i+=2
#    return'\n'.join(''if v is None else v for v in out)

def transform_dxf(dxf_text, x_off, y_off, rot_deg, scale, flip_y=False):
    c = math.cos(math.radians(rot_deg))
    s = math.sin(math.radians(rot_deg))
    
    def tp(x, y):
        # Apply the flip only if flip_y is True
        # This mirrors the spiral vertically for the YZ plane logic
        actual_y = -y if flip_y else y
        xs, ys = x * scale, actual_y * scale
        return xs * c - ys * s + x_off, xs * s + ys * c + y_off
        
    lines = dxf_text.splitlines(); out = []; xb = {}; xp = {}
    i = 0
    while i < len(lines):
        rc = lines[i].strip()
        if i + 1 >= len(lines): out.append(lines[i]); break
        rv = lines[i + 1]
        try: code = int(rc)
        except: out.append(lines[i]); i += 1; continue
        if code in (10, 11):
            xb[code] = float(rv.strip()); out.append(lines[i]); xp[code] = len(out); out.append(None); i += 2
        elif code in (20, 21):
            xc = code - 10
            if xc in xb:
                xt, yt = tp(xb.pop(xc), float(rv.strip()))
                out[xp.pop(xc)] = f'{xt:.6f}'; out.append(lines[i]); out.append(f'{yt:.6f}')
            else: out.append(lines[i]); out.append(rv)
            i += 2
        else: out.append(lines[i]); out.append(rv); i += 2
    return '\n'.join('' if v is None else v for v in out)

def do_import(dxf_text, filename, entity, z_off=0):
    """Import DXF spiral into Fusion 360.

    Uses Fusion's importManager.createDXF2DImportOptions for ALL entity types
    (ConstructionPlane, BRepFace, Sketch).  This is the most reliable approach
    because Fusion handles all coordinate-system transforms internally.

    The old draw_lines_in_sketch() approach was removed -- it incorrectly applied
    sk.transform (sketch-local -> world) then passed world-space coordinates to
    addByTwoPoints(), which expects sketch-local coordinates, causing lines to
    land in the wrong place or not appear at all.
    
    z_off: Z-axis offset in mm (used to extrude sketch after import, if needed)
    """
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design: return None, 'error:No active design.'
    root = design.rootComponent
    mgr = app.importManager
    try:
        # Validate face is planar before attempting import
        if isinstance(entity, adsk.fusion.BRepFace):
            if not isinstance(entity.geometry, adsk.core.Plane):
                return None, 'error:Face is not flat.'

        # Write DXF to a temp file and hand it to Fusion's built-in importer.
        # createDXF2DImportOptions accepts ConstructionPlane, BRepFace, or Sketch.
        tmp_fd, tmp_path = tempfile.mkstemp(suffix='.dxf', prefix='spiral_')
        try:
            with os.fdopen(tmp_fd, 'w') as f: f.write(dxf_text)
            before = root.sketches.count
            opts = mgr.createDXF2DImportOptions(tmp_path, entity)
            mgr.importToTarget(opts, root)
            if root.sketches.count > before:
                sk = root.sketches.item(root.sketches.count - 1)
                # Note: z_off is available for future use (e.g., extrude operation)
                # Currently, the sketch is imported at the target location.
                # To use z_off, you could add: sk.origin.setAsActive() or extrude the profile
                return sk, 'ok:' + filename
            return None, 'ok:' + filename
        finally:
            try: os.unlink(tmp_path)
            except: pass

    except Exception:
        return None, 'error:' + traceback.format_exc()


def get_vals(inputs):
    return(inputs.itemById('xOff').value*10,
           inputs.itemById('yOff').value*10,
           inputs.itemById('zOff').value*10,
           math.degrees(inputs.itemById('rot').value),
           max(inputs.itemById('scale').value,1e-6))

#class PlaneSelectExecuteHandler(adsk.core.CommandEventHandler):
#    def __init__(self): super().__init__()
#    def notify(self,args):
#        global _pending_dxf
#        try:
#            cmd=adsk.core.Command.cast(args.command)
#            sel=adsk.core.SelectionCommandInput.cast(cmd.commandInputs.itemById('target'))
#            if sel.selectionCount==0 or _pending_dxf is None: return
#            entity=sel.selection(0).entity
#            x,y,z,r,sc=get_vals(cmd.commandInputs)
#            dxf_text=_pending_dxf['dxfContent']
#            fn=_pending_dxf['filename']
#            _pending_dxf=None
#            transformed=transform_dxf(dxf_text,x,y,r,sc)
#            sk,msg=do_import(transformed,fn,entity,z)
#            pal=ui.palettes.itemById(PALETTE_ID)
#            if msg.startswith('ok:'):
#                if pal: pal.sendInfoToHTML('importSuccess',fn)
#            else:
#                if pal: pal.sendInfoToHTML('importError',msg)
#                ui.messageBox('Import error:\n'+msg)
#        except Exception:
#            if ui: ui.messageBox('execute error:\n'+traceback.format_exc())

class PlaneSelectExecuteHandler(adsk.core.CommandEventHandler):
    def __init__(self): super().__init__()
    def notify(self, args):
        global _pending_dxf
        try:
            cmd = adsk.core.Command.cast(args.command)
            sel = adsk.core.SelectionCommandInput.cast(cmd.commandInputs.itemById('target'))
            if sel.selectionCount == 0 or _pending_dxf is None: return
            
            entity = sel.selection(0).entity
            x, y, z, r, sc = get_vals(cmd.commandInputs)
            dxf_text = _pending_dxf['dxfContent']
            fn = _pending_dxf['filename']
            _pending_dxf = None

            # --- Start Plane Detection ---
            is_flipped_plane = False
            try:
                if hasattr(entity, 'geometry') and hasattr(entity.geometry, 'normal'):
                    norm = entity.geometry.normal
                    # Flip if it's YZ (X-axis normal) OR XY (Z-axis normal)
                    if abs(norm.x) > 0.9 or abs(norm.z) > 0.9:
                        is_flipped_plane = True
            except:
                pass

            # Pass the result to the flip_y parameter
            transformed = transform_dxf(dxf_text, x, y, r, sc, flip_y=is_flipped_plane)
            # --- End Plane Detection ---

            sk, msg = do_import(transformed, fn, entity, z)
            pal = ui.palettes.itemById(PALETTE_ID)
            if msg.startswith('ok:'):
                if pal: pal.sendInfoToHTML('importSuccess', fn)
            else:
                if pal: pal.sendInfoToHTML('importError', msg)
                ui.messageBox('Import error:\n' + msg)
        except Exception:
            if ui: ui.messageBox('execute error:\n' + traceback.format_exc())

class PlaneSelectDestroyHandler(adsk.core.CommandEventHandler):
    def __init__(self): super().__init__()
    def notify(self,args):
        global _pending_dxf
        if _pending_dxf is not None:
            _pending_dxf=None
            pal=ui.palettes.itemById(PALETTE_ID)
            if pal: pal.sendInfoToHTML('importCancelled','')

class PlaneSelectInputChangedHandler(adsk.core.InputChangedEventHandler):
    def __init__(self): super().__init__()
    def notify(self,args):
        try:
            ch=args.input; inps=args.inputs
            if ch.id=='target':
                sel=adsk.core.SelectionCommandInput.cast(ch); has=sel.selectionCount>0
                for k in('xOff','yOff','zOff','rot','scale'):
                    it=inps.itemById(k)
                    if it: it.isEnabled=has
        except: pass

class PlaneSelectValidateHandler(adsk.core.ValidateInputsEventHandler):
    def __init__(self): super().__init__()
    def notify(self,args):
        try: args.areInputsValid=adsk.core.SelectionCommandInput.cast(args.inputs.itemById('target')).selectionCount==1
        except: args.areInputsValid=False

class PlaneSelectCreatedHandler(adsk.core.CommandCreatedEventHandler):
    def __init__(self): super().__init__()
    def notify(self,args):
        try:
            cmd=adsk.core.Command.cast(args.command)
            e=PlaneSelectExecuteHandler();d=PlaneSelectDestroyHandler()
            ic=PlaneSelectInputChangedHandler();v=PlaneSelectValidateHandler()
            cmd.execute.add(e);cmd.destroy.add(d);cmd.inputChanged.add(ic);cmd.validateInputs.add(v)
            handlers.extend([e,d,ic,v])
            inps=cmd.commandInputs
            active_sketch=None
            try:
                ao=app.activeEditObject
                if ao and ao.classType()==adsk.fusion.Sketch.classType(): active_sketch=adsk.fusion.Sketch.cast(ao)
            except: pass
            hint=('<b>Select target</b> — construction plane, flat face, or existing sketch.<br>'
                  'Adjust X/Y/Z offset, rotation and scale, then click <b>OK</b> to place.')
            if active_sketch: hint=f'<b>Active sketch: &quot;{active_sketch.name}&quot;</b> — select it or pick another target.'
            inps.addTextBoxCommandInput('hint','',hint,3,True)
            sel=inps.addSelectionInput('target','Target','Construction plane, flat face, or sketch')
            sel.addSelectionFilter('ConstructionPlanes');sel.addSelectionFilter('PlanarFaces');sel.addSelectionFilter('Sketches')
            sel.setSelectionLimits(1,1)
            inps.addSeparatorCommandInput('sep')
            z=adsk.core.ValueInput.createByReal(0);o=adsk.core.ValueInput.createByReal(1)
            for inp in(inps.addValueInput('xOff','X Offset','mm',z),
                       inps.addValueInput('yOff','Y Offset','mm',z),
                       inps.addValueInput('zOff','Z Offset','mm',z),
                       inps.addValueInput('rot','Rotation','deg',z),
                       inps.addValueInput('scale','Scale','',o)):
                inp.isEnabled=False
        except Exception:
            if ui: ui.messageBox('created error:\n'+traceback.format_exc())

class PlaneSelectTriggerHandler(adsk.core.CustomEventHandler):
    def __init__(self): super().__init__()
    def notify(self,args):
        try:
            old=ui.commandDefinitions.itemById(PLANE_CMD_ID)
            if old: old.deleteMe()
            cd=ui.commandDefinitions.addButtonDefinition(PLANE_CMD_ID,'Place Spiral','','')
            h=PlaneSelectCreatedHandler();cd.commandCreated.add(h);handlers.append(h);cd.execute()
        except Exception:
            if ui: ui.messageBox('trigger error:\n'+traceback.format_exc())

class PaletteMessageHandler(adsk.core.HTMLEventHandler):
    def __init__(self): super().__init__()
    def notify(self,args):
        global _pending_dxf
        try:
            ha=adsk.core.HTMLEventArgs.cast(args)
            if ha.action!='exportDXF': return
            p=json.loads(ha.data); _pending_dxf={'dxfContent':p['dxfContent'],'filename':p.get('filename','spiral.dxf')}
            app.fireCustomEvent(CUSTOM_EVENT_ID,'')
        except Exception:
            if ui: ui.messageBox('palette msg error:\n'+traceback.format_exc())

class CommandExecuteHandler(adsk.core.CommandEventHandler):
    def __init__(self): super().__init__()
    def notify(self,args):
        try:
            pal=ui.palettes.itemById(PALETTE_ID)
            if pal: pal.isVisible=True; return
            d=os.path.dirname(os.path.realpath(__file__))
            hp=os.path.join(d,'index.html')
            if not os.path.isfile(hp): ui.messageBox('index.html not found'); return
            pal=ui.palettes.add(PALETTE_ID,'Archimedean Spiral Compass',Path(hp).as_uri(),True,True,True,880,660)
            pal.dockingState=adsk.core.PaletteDockingStates.PaletteDockStateFloating
            h=PaletteMessageHandler();pal.incomingFromHTML.add(h);handlers.append(h)
        except Exception:
            if ui: ui.messageBox('cmd execute error:\n'+traceback.format_exc())

class CommandCreatedHandler(adsk.core.CommandCreatedEventHandler):
    def __init__(self): super().__init__()
    def notify(self,args):
        try:
            cmd=adsk.core.Command.cast(args.command);h=CommandExecuteHandler()
            cmd.execute.add(h);cmd.isExecutedWhenPreEmpted=False;handlers.append(h)
        except Exception:
            if ui: ui.messageBox('cmd created error:\n'+traceback.format_exc())

def run(context):
    global app,ui,_custom_event
    try:
        app=adsk.core.Application.get();ui=app.userInterface
        _custom_event=app.registerCustomEvent(CUSTOM_EVENT_ID)
        h=PlaneSelectTriggerHandler();_custom_event.add(h);handlers.append(h)
        ws=ui.workspaces.itemById(WORKSPACE_ID);panel=ws.toolbarPanels.itemById(PANEL_ID)
        stale_ctrl=panel.controls.itemById(COMMAND_ID)
        if stale_ctrl: stale_ctrl.deleteMe()
        ex=ui.commandDefinitions.itemById(COMMAND_ID)
        if ex: ex.deleteMe()
        cd=ui.commandDefinitions.addButtonDefinition(COMMAND_ID,'Spiral Compass','Open Spiral Compass','')
        h=CommandCreatedHandler();cd.commandCreated.add(h);handlers.append(h)
        ctrl=panel.controls.addCommand(cd);ctrl.isPromoted=True
    except Exception:
        if ui: ui.messageBox('run error:\n'+traceback.format_exc())

def stop(context):
    global app,ui,_custom_event
    try:
        if _custom_event: app.unregisterCustomEvent(CUSTOM_EVENT_ID);_custom_event=None
        ws=ui.workspaces.itemById(WORKSPACE_ID);panel=ws.toolbarPanels.itemById(PANEL_ID)
        c=panel.controls.itemById(COMMAND_ID)
        if c: c.deleteMe()
        for cid in[COMMAND_ID,PLANE_CMD_ID]:
            d=ui.commandDefinitions.itemById(cid)
            if d: d.deleteMe()
        pal=ui.palettes.itemById(PALETTE_ID)
        if pal: pal.deleteMe()
    except Exception:
        if ui: ui.messageBox('stop error:\n'+traceback.format_exc())